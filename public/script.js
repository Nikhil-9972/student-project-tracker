const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const formTitle = document.querySelector('#form-title');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';

let projects = [];
let editingId = null;
let storageReady = false;

function isValidProjects(value) {
    return Array.isArray(value) && value.every(project =>
        project !== null &&
        typeof project === 'object' &&
        !Array.isArray(project) &&
        typeof project.id === 'string' &&
        project.id.length > 0 &&
        typeof project.name === 'string' &&
        project.name.trim().length > 0 &&
        typeof project.status === 'string' &&
        ['Planned', 'In Progress', 'Completed'].includes(project.status)
    ) && new Set(value.map(project => project.id)).size === value.length;
}

function loadProjects() {
    try {
        const storedText = localStorage.getItem(STORAGE_KEY);

        if (storedText === null) {
            projects = [];
            storageReady = true;
            return true;
        }

        const storedProjects = JSON.parse(storedText);

        if (!isValidProjects(storedProjects)) {
            message.textContent =
                'Saved project data is invalid. Your stored data has not been overwritten.';
            storageReady = false;
            return false;
        }

        projects = storedProjects;
        storageReady = true;
        return true;
    } catch (error) {
        message.textContent =
            'Could not read saved projects. Check browser storage permissions. Existing stored data has not been intentionally changed.';
        storageReady = false;
        return false;
    }
}

function saveProjects() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        message.textContent = '';
        return true;
    } catch (error) {
        message.textContent =
            'Changes could not be saved to browser storage. Your latest changes may be lost if you refresh.';
        return false;
    }
}

function renderProjects() {
    projectList.textContent = '';

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
            editingId = project.id;

            nameInput.value = project.name;
            statusInput.value = project.status;

            saveButton.textContent = 'Save changes';
            cancelButton.hidden = false;
            formTitle.textContent = 'Edit Project';

            if (storageReady) {
                message.textContent = '';
            }

            nameInput.focus();
        });

        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';

        deleteButton.addEventListener('click', () => {
            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            if (!confirmed) {
                return;
            }

            if (!storageReady) {
                message.textContent =
                    'Deletion is disabled because saved project data could not be loaded safely.';
                return;
            }

            const projectIndex = projects.findIndex(
                item => item.id === project.id
            );

            if (projectIndex === -1) {
                return;
            }

            const updatedProjects = projects.filter(
                item => item.id !== project.id
            );

            if (!saveProjectsArray(updatedProjects)) {
                return;
            }

            projects = updatedProjects;

            if (editingId === project.id) {
                resetForm();
            }

            renderProjects();
        });

        listItem.appendChild(projectName);
        listItem.appendChild(projectStatus);
        listItem.appendChild(document.createTextNode(' '));
        listItem.appendChild(editButton);
        listItem.appendChild(document.createTextNode(' '));
        listItem.appendChild(deleteButton);

        projectList.appendChild(listItem);
    });

    if (emptyState) {
        emptyState.hidden = projects.length > 0;
    }
}

function saveProjectsArray(updatedProjects) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
        message.textContent = '';
        return true;
    } catch (error) {
        message.textContent =
            'Changes could not be saved to browser storage. Your saved projects remain unchanged.';
        return false;
    }
}

function resetForm() {
    form.reset();

    editingId = null;

    saveButton.textContent = 'Save Project';
    cancelButton.hidden = true;
    formTitle.textContent = 'Add a Project';

    if (storageReady) {
        message.textContent = '';
    }
}

form.addEventListener('submit', event => {
    event.preventDefault();

    if (!storageReady) {
        message.textContent =
            'Projects cannot be changed safely until saved data can be loaded.';
        return;
    }

    const name = nameInput.value.trim();
    const status = statusInput.value;

    if (name === '') {
        message.textContent = 'Please enter a project name.';
        nameInput.focus();
        return;
    }

    if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
        message.textContent = 'Please select a valid project status.';
        return;
    }

    let updatedProjects;

    if (editingId !== null) {
        const projectExists = projects.some(
            project => project.id === editingId
        );

        if (!projectExists) {
            resetForm();
            renderProjects();
            message.textContent =
                'The project being edited no longer exists. Please try again.';
            return;
        }

        updatedProjects = projects.map(project =>
            project.id === editingId
                ? { ...project, name, status }
                : project
        );
    } else {
        const newProject = {
            id: crypto.randomUUID(),
            name,
            status
        };

        updatedProjects = [...projects, newProject];
    }

    if (!saveProjectsArray(updatedProjects)) {
        return;
    }

    projects = updatedProjects;

    resetForm();
    renderProjects();
    nameInput.focus();
});

cancelButton.addEventListener('click', () => {
    resetForm();
});

loadProjects();
renderProjects();
