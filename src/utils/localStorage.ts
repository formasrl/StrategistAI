// src/utils/localStorage.ts

const LAST_ACTIVE_STEP_KEY = 'lastActiveStep';

interface LastActiveStep {
  projectId: string;
  stepId: string;
  documentId?: string; // Optional, if we want to be more specific
}

/**
 * Saves the last active project and step/document IDs to local storage.
 * @param projectId The ID of the current project.
 * @param stepId The ID of the current step.
 * @param documentId Optional: The ID of the current document.
 */
export const saveLastActiveStep = (projectId: string, stepId: string, documentId?: string) => {
  try {
    const data: LastActiveStep = { projectId, stepId, documentId };
    localStorage.setItem(LAST_ACTIVE_STEP_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving last active step to local storage:', error);
  }
};

/**
 * Retrieves the last active project and step/document IDs from local storage.
 * @returns The last active step data or null if not found/error.
 */
export const getLastActiveStep = (): LastActiveStep | null => {
  try {
    const data = localStorage.getItem(LAST_ACTIVE_STEP_KEY);
    return data ? (JSON.parse(data) as LastActiveStep) : null;
  } catch (error) {
    console.error('Error retrieving last active step from local storage:', error);
    return null;
  }
};

/**
 * Clears the last active step data from local storage.
 */
export const clearLastActiveStep = () => {
  try {
    localStorage.removeItem(LAST_ACTIVE_STEP_KEY);
  } catch (error) {
    console.error('Error clearing last active step from local storage:', error);
  }
};