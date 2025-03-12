import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

// Local storage helpers
export function getLocalData<T = any>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting data for ${key}:`, error);
    return null;
  }
}

export function setLocalData(key: string, data: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving data for ${key}:`, error);
  }
}

export function logActivity(activity: {
  type: string;
  action: string;
  name: string;
  time: string;
  iconKey: string; 
  iconColor: string;
  avatar?: string;
}) {
  const currentActivities = getLocalData("recentActivity") || [];
  const newActivity = {
    id: generateId(),
    ...activity,
  };
  const updatedActivities = [newActivity, ...currentActivities];
  setLocalData("recentActivity", updatedActivities);
  window.dispatchEvent(new Event("recentActivityUpdated"));
}
