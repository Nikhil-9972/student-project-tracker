const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const formTitle = document.querySelector('#form-title');
const message = document.querySelector('#message');

const validStatuses = ['Planned', 'In Progress', 'Completed'];

let projects = [];
let editingId = null;
let isLoading = false;
let isMutating = false;
let hasLoadedSuccessfully = false;

function sameId(first, second) {
    return String(first) === String(second);
}

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

// Extract a useful API error message.
async function getApiErrorMessage(response) {
    try {
        const data = await response.json();

        if (
            typeof data.error === 'string' &&
            data.error.trim() !== ''
        ) {
            return data.error;
        }

        if (
            typeof data.message === 'string' &&
            data.message.trim() !== ''
        ) {
            return data.message;
        }
    } catch {
        // The response may not contain JSON.
    }

    return `Request failed with HTTP ${response.status}.`;
}

// Send an API request and check response.ok.
async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch {
        throw new Error(
            'Could not connect to the server. Check that it is running and try again.'
        );
    }

    if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
    }

    return response;
}

// Disable controls while loading or saving.
function updateControls() {
    const pending = isLoading || isMutating;

    nameInput.disabled = pending;
    statusInput.disabled = pending;
    saveButton.disabled = pending || !hasLoadedSuccessfully;
    cancelButton.disabled = pending;

    projectList.querySelectorAll('button').forEach(button => {
        button.disabled = pending || !hasLoadedSuccessfully;
    });
}

// Render the API collection safely.
function renderProjects() {
    projectList.replaceChildren();

    projects.forEach(project => {
        const listItem = document.createElement('li');
        const projectName = document.createElement('span');
        const projectStatus = document.createElement('span');
        const editButton = document.createElement('button');
        const deleteButton = document.createElement('button');

        // Never interpret an entered project name as HTML.
        projectName.textContent = project.name;
        projectStatus.textContent = ` — ${project.status}`;

        editButton.type = 'button';
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            if (
                isLoading ||
                isMutating ||
                !hasLoadedSuccessfully
            ) {
                return;
            }

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
            if (
                isLoading ||
                isMutating ||
                !hasLoadedSuccessfully
            ) {
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            // Cancellation must not send a DELETE request.
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

    // Only a successfully loaded empty collection is empty.
    emptyState.hidden = !(
        hasLoadedSuccessfully && projects.length === 0
    );

    updateControls();
}

// Load projects from the server.
async function loadProjects({
    successMessage = '',
    mutationSucceeded = false
} = {}) {
    isLoading = true;
    updateControls();

    emptyState.hidden = true;
    message.textContent = 'Loading projects...';

    try {
        const response = await apiRequest('/api/projects');

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                'The server returned an invalid JSON response.'
            );
        }

        if (!isValidProjects(data)) {
            throw new Error(
                'The server returned an invalid project list.'
            );
        }

        projects = data;
        hasLoadedSuccessfully = true;

        renderProjects();

        if (successMessage) {
            message.textContent = successMessage;
        } else if (projects.length === 0) {
            message.textContent = 'No projects yet.';
        } else {
            message.textContent = 'Projects loaded successfully.';
        }

        return true;
    } catch (error) {
        hasLoadedSuccessfully = false;
        emptyState.hidden = true;

        if (mutationSucceeded) {
            message.textContent =
                `${successMessage} However, the project list could not be refreshed. ${error.message}`;
        } else {
            message.textContent =
                `Could not load projects. ${error.message}`;
        }

        return false;
    } finally {
        isLoading = false;
        updateControls();
    }
}

// Return the form to Add mode.
function resetForm({ clearMessage = true } = {}) {
    form.reset();

    editingId = null;

    saveButton.textContent = 'Save Project';
    cancelButton.hidden = true;
    formTitle.textContent = 'Add a Project';

    if (clearMessage) {
        message.textContent = '';
    }
}

// One submit listener handles both POST and PUT.
form.addEventListener('submit', async event => {
    event.preventDefault();

    // Prevent repeated submissions.
    if (isLoading || isMutating) {
        return;
    }

    const name = nameInput.value.trim();
    const status = statusInput.value;
    const targetId = editingId;
    const isEditing = targetId !== null;

    if (!hasLoadedSuccessfully) {
        message.textContent =
            'Projects could not be loaded. Please reload the project list before saving.';
        return;
    }

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

    if (isEditing) {
        const projectExists = projects.some(
            project => sameId(project.id, targetId)
        );

        if (!projectExists) {
            resetForm();

            message.textContent =
                'The project being edited no longer exists. Please try again.';
            return;
        }
    }

    const url = isEditing
        ? `/api/projects/${encodeURIComponent(targetId)}`
        : '/api/projects';

    const method = isEditing ? 'PUT' : 'POST';

    isMutating = true;
    updateControls();

    message.textContent = isEditing
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

        // Clear the form only after the mutation succeeds.
        resetForm({ clearMessage: false });

        const successText = isEditing
            ? 'Project updated successfully.'
            : 'Project created successfully.';

        await loadProjects({
            successMessage: successText,
            mutationSucceeded: true
        });

        if (hasLoadedSuccessfully) {
            nameInput.focus();
        }
    } catch (error) {
        // Preserve the entered name, status and Edit mode.
        message.textContent = error.message;
    } finally {
        isMutating = false;
        updateControls();
    }
});

// Delete a project through the API.
async function deleteProject(project) {
    if (
        isLoading ||
        isMutating ||
        !hasLoadedSuccessfully
    ) {
        return;
    }

    isMutating = true;
    updateControls();

    message.textContent = 'Deleting project...';

    try {
        await apiRequest(
            `/api/projects/${encodeURIComponent(project.id)}`,
            {
                method: 'DELETE'
            }
        );

        // If the edited record was deleted, exit Edit mode.
        if (
            editingId !== null &&
            sameId(editingId, project.id)
        ) {
            resetForm({ clearMessage: false });
        }

        await loadProjects({
            successMessage: 'Project deleted successfully.',
            mutationSucceeded: true
        });
    } catch (error) {
        message.textContent = error.message;
    } finally {
        isMutating = false;
        updateControls();
    }
}

// Cancel Edit without contacting the API.
cancelButton.addEventListener('click', () => {
    if (isLoading || isMutating) {
        return;
    }

    resetForm();
});

// Load the API collection on page startup.
loadProjects();
