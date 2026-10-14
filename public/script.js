const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const formTitle = document.querySelector('#form-title');
const message = document.querySelector('#message');

let projects = [];
let editingId = null;
let isBusy = false;
let hasLoadedSuccessfully = false;

const validStatuses = ['Planned', 'In Progress', 'Completed'];

// Validate the collection returned by the API.
function isValidProjects(value) {
    if (!Array.isArray(value)) {
        return false;
    }

    const seenIds = new Set();

    return value.every(project => {
        if (
            project === null ||
            typeof project !== 'object' ||
            Array.isArray(project)
        ) {
            return false;
        }

        const validId =
            (typeof project.id === 'number' &&
                Number.isSafeInteger(project.id) &&
                project.id > 0) ||
            (typeof project.id === 'string' &&
                project.id.trim() !== '');

        if (
            !validId ||
            typeof project.name !== 'string' ||
            project.name.trim() === '' ||
            project.name.length > 80 ||
            typeof project.status !== 'string' ||
            !validStatuses.includes(project.status)
        ) {
            return false;
        }

        const idKey = String(project.id);

        if (seenIds.has(idKey)) {
            return false;
        }

        seenIds.add(idKey);
        return true;
    });
}

// Read a useful error message from an unsuccessful API response.
async function getApiErrorMessage(response) {
    try {
        const data = await response.json();

        if (typeof data.error === 'string' && data.error.trim()) {
            return data.error;
        }

        if (typeof data.message === 'string' && data.message.trim()) {
            return data.message;
        }
    } catch {
        // The response may not contain JSON.
    }

    return `Request failed (${response.status}${response.statusText
        ? ` ${response.statusText}`
        : ''
        }).`;
}

// Send a request and check the HTTP response.
async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch {
        throw new Error(
            'Could not connect to the server. Check that your Express server is running and try again.'
        );
    }

    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
    }

    return response;
}

// Disable editing controls while loading or saving.
function updateControls() {
    const disabled = isBusy || !hasLoadedSuccessfully;

    nameInput.disabled = disabled;
    statusInput.disabled = disabled;
    saveButton.disabled = disabled;
    cancelButton.disabled = isBusy;

    projectList.querySelectorAll('button').forEach(button => {
        button.disabled = disabled;
    });
}

// Load the latest collection from the API.
// A failed load is never treated as an empty collection.
async function loadProjects({
    successMessage = '',
    afterMutation = false
} = {}) {
    hasLoadedSuccessfully = false;
    isBusy = true;

    updateControls();
    emptyState.hidden = true;

    message.textContent = afterMutation
        ? 'Refreshing projects...'
        : 'Loading projects...';

    try {
        const response = await apiRequest('/api/projects');

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error('The server returned an invalid JSON response.');
        }

        if (!isValidProjects(data)) {
            throw new Error(
                'The server returned an invalid project list. Please check the API response.'
            );
        }

        // Use the server collection as the source of truth.
        projects = data;
        hasLoadedSuccessfully = true;

        renderProjects();

        if (successMessage) {
            message.textContent = successMessage;
        } else if (projects.length > 0) {
            message.textContent = 'Projects loaded successfully.';
        } else {
            message.textContent = '';
        }
    } catch (error) {
        // Do not show the empty state when loading failed.
        hasLoadedSuccessfully = false;
        emptyState.hidden = true;

        if (afterMutation) {
            message.textContent =
                `${successMessage} However, the project list could not be refreshed. ` +
                error.message;
        } else {
            message.textContent =
                `Could not load projects. ${error.message}`;
        }
    } finally {
        isBusy = false;
        updateControls();
    }
}

// Render API records safely using textContent.
function renderProjects() {
    projectList.replaceChildren();

    projects.forEach(project => {
        const listItem = document.createElement('li');
        const projectName = document.createElement('span');
        const projectStatus = document.createElement('span');
        const editButton = document.createElement('button');
        const deleteButton = document.createElement('button');

        projectName.textContent = project.name;
        projectStatus.textContent = ` — ${project.status}`;

        editButton.type = 'button';
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            if (isBusy || !hasLoadedSuccessfully) {
                return;
            }

            // Keep the ID returned by the server.
            editingId = project.id;

            nameInput.value = project.name;
            statusInput.value = project.status;

            saveButton.textContent = 'Save changes';
            cancelButton.hidden = false;
            formTitle.textContent = 'Edit Project';
            message.textContent = '';

            nameInput.focus();
        });

        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';

        deleteButton.addEventListener('click', async () => {
            if (isBusy || !hasLoadedSuccessfully) {
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            // Cancelled deletion sends no request.
            if (!confirmed) {
                return;
            }

            await deleteProject(project);
        });

        listItem.append(
            projectName,
            projectStatus,
            document.createTextNode(' '),
            editButton,
            document.createTextNode(' '),
            deleteButton
        );

        projectList.appendChild(listItem);
    });

    // Show the empty message only after a successful API load.
    emptyState.hidden = !(
        hasLoadedSuccessfully && projects.length === 0
    );

    updateControls();
}

function resetForm({ clearMessage = true } = {}) {
    form.reset();

    editingId = null;

    saveButton.textContent = 'Save Project';
    cancelButton.hidden = true;
    formTitle.textContent = 'Add a Project';

    if (clearMessage && hasLoadedSuccessfully) {
        message.textContent = '';
    }
}

// Create or update through the API.
form.addEventListener('submit', async event => {
    event.preventDefault();

    if (isBusy || !hasLoadedSuccessfully) {
        return;
    }

    const name = nameInput.value.trim();
    const status = statusInput.value;

    if (name === '') {
        message.textContent = 'Please enter a project name.';
        nameInput.focus();
        return;
    }

    if (name.length > 80) {
        message.textContent =
            'Project name must be 80 characters or fewer.';
        nameInput.focus();
        return;
    }

    if (!validStatuses.includes(status)) {
        message.textContent = 'Please select a valid project status.';
        return;
    }

    const wasEditing = editingId !== null;
    const targetId = editingId;

    if (wasEditing) {
        const projectExists = projects.some(
            project => project.id === targetId
        );

        if (!projectExists) {
            resetForm();
            renderProjects();

            message.textContent =
                'The project being edited no longer exists. Please try again.';
            return;
        }
    }

    const url = wasEditing
        ? `/api/projects/${encodeURIComponent(targetId)}`
        : '/api/projects';

    const method = wasEditing ? 'PUT' : 'POST';

    isBusy = true;
    updateControls();
    message.textContent = wasEditing
        ? 'Saving project changes...'
        : 'Saving project...';

    try {
        await apiRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, status })
        });

        // The mutation succeeded. Fetch the latest collection;
        // don't append a local record or generate an ID in the browser.
        const successMessage = wasEditing
            ? 'Project updated successfully.'
            : 'Project created successfully.';

        resetForm({ clearMessage: false });
        hasLoadedSuccessfully = false;

        await loadProjects({
            successMessage,
            afterMutation: true
        });

        if (hasLoadedSuccessfully) {
            nameInput.focus();
        }
    } catch (error) {
        // Keep the user's input and edit mode when the mutation fails.
        message.textContent = error.message;
    } finally {
        isBusy = false;
        updateControls();
    }
});

// Delete through the API.
async function deleteProject(project) {
    if (isBusy || !hasLoadedSuccessfully) {
        return;
    }

    isBusy = true;
    updateControls();
    message.textContent = 'Deleting project...';

    try {
        await apiRequest(
            `/api/projects/${encodeURIComponent(project.id)}`,
            {
                method: 'DELETE'
            }
        );

        // If the deleted record was being edited, leave Edit mode.
        if (editingId === project.id) {
            resetForm({ clearMessage: false });
        }

        hasLoadedSuccessfully = false;

        await loadProjects({
            successMessage: 'Project deleted successfully.',
            afterMutation: true
        });
    } catch (error) {
        message.textContent = error.message;
    } finally {
        isBusy = false;
        updateControls();
    }
}

// Cancel edit sends no API request.
cancelButton.addEventListener('click', () => {
    if (isBusy) {
        return;
    }

    resetForm();
});

// Load the database-backed collection when the page opens.
loadProjects();
