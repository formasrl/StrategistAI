// src/utils/localStorage.ts

const LAST_ACTIVE_STEP_KEY = 'lastActiveStep';
const LAST_ACTIVE_CHAT_KEY_PREFIX = 'lastActiveChat_'; // Prefix for chat session keys

interface LastActiveStep {
  projectId: string;
  stepId: string;
  documentId?: string; // Optional, if we want to be more specific
}

/**
 * Generates a unique key for storing chat session data based on project, step, and document IDs.
 * @param projectId The ID of the current project.
 * @param stepId The ID of the current step.
 * @param documentId Optional: The ID of the current document.
 * @returns A unique string key for local storage.
 */
const generateChatSessionKey = (projectId: string, stepId?: string, documentId?: string): string => {
  return `${LAST_ACTIVE_CHAT_KEY_PREFIX}${projectId}_${stepId || 'null'}_${documentId || 'null'}`;
};

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

/**
 * Saves the last active chat session ID for a given context to local storage.
 * @param projectId The ID of the current project.
 * @param stepId The ID of the current step.
 * @param documentId Optional: The ID of the current document.
 * @param chatSessionId The ID of the chat session to save.
 */
export const saveLastActiveChatSession = (projectId: string, stepId: string | undefined, documentId: string | undefined, chatSessionId: string) => {
  try {
    const key = generateChatSessionKey(projectId, stepId, documentId);
    localStorage.setItem(key, chatSessionId);
  } catch (error) {
    console.error('Error saving last active chat session to local storage:', error);
  }
};

/**
 * Retrieves the last active chat session ID for a given context from local storage.
 * @param projectId The ID of the current project.
 * @param stepId The ID of the current step.
 * @param documentId Optional: The ID of the current document.
 * @returns The last active chat session ID or null if not found/error.
 */
export const getLastActiveChatSession = (projectId: string, stepId: string | undefined, documentId: string | undefined): string | null => {
  try {
    const key = generateChatSessionKey(projectId, stepId, documentId);
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Error retrieving last active chat session from local storage:', error);
    return null;
  }
};

/**
 * Clears the last active chat session ID for a given context from local storage.
 * @param projectId The ID of the current project.
 * @param stepId The ID of the current step.
 * @param documentId Optional: The ID of the current document.
 */
export const clearLastActiveChatSession = (projectId: string, stepId: string | undefined, documentId: string | undefined) => {
  try {
    const key = generateChatSessionKey(projectId, stepId, documentId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing last active chat session from local storage:', error);
  }
};