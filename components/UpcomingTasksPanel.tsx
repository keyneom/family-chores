import React, { useMemo, useState, useEffect } from "react";
import { useChoresApp, Child } from "./ChoresAppContext";
import { getNextExecutionDateTimes } from "../utils/recurrenceBuilder";
import { assignTaskToChild } from "../utils/taskAssignment";
import type Task from "../types/task";

interface UpcomingTasksPanelProps {
  maxEntries?: number;
  occurrencesPerTask?: number;
}

interface UpcomingEntry {
  taskId: string;
  taskTitle: string;
  dateTime: string;
  childNames: string[];
}

function formatDateTime(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    return Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return date.toISOString();
}

function childNamesForAssignment(assignments: Child[]): string[] {
  return assignments.map((child) => child.name);
}

function getUpcomingForTask(task: Task, children: Child[], today: string, perTask: number): UpcomingEntry[] {
  if (!task.enabled) return [];

  // One-off tasks: show the due date if in the future
  if (task.type === "oneoff" && task.oneOff?.dueDate) {
    const dueDate = task.oneOff.dueDate;
    if (new Date(dueDate) < new Date()) {
      return [];
    }
    const assignments = assignTaskToChild(task, children, { date: dueDate.split("T")[0] });
    if (!assignments || assignments.length === 0) return [];
    return [
      {
        taskId: task.id,
        taskTitle: task.title || "One-off chore",
        dateTime: dueDate,
        childNames: childNamesForAssignment(assignments.map((plan) => plan.child)),
      },
    ];
  }

  if (!task.schedule) return [];

  const occurrences = getNextExecutionDateTimes(task.schedule, today, perTask);
  const entries: UpcomingEntry[] = [];

  occurrences.forEach((dateTime) => {
    const dateOnly = dateTime.split("T")[0];
    const assignments = assignTaskToChild(task, children, { date: dateOnly });
    if (!assignments || assignments.length === 0) return;
    entries.push({
      taskId: task.id,
      taskTitle: task.title || "Chore",
      dateTime,
      childNames: childNamesForAssignment(assignments.map((plan) => plan.child)),
    });
  });

  return entries;
}

const UpcomingTasksPanel: React.FC<UpcomingTasksPanelProps> = ({
  maxEntries = 8,
  occurrencesPerTask = 3,
}) => {
  const { state } = useChoresApp();
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setMounted(true);
    setToday(new Date().toISOString().split("T")[0]);
  }, []);

  const upcoming = useMemo(() => {
    if (!mounted) return [];
    const entries: UpcomingEntry[] = [];
    state.tasks.forEach((task) => {
      const taskEntries = getUpcomingForTask(task, state.children, today, occurrencesPerTask);
      entries.push(...taskEntries);
    });

    return entries
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
      .slice(0, maxEntries);
  }, [state.tasks, state.children, today, maxEntries, occurrencesPerTask, mounted]);

  if (upcoming.length === 0) {
    return (
      <section className="upcoming-panel">
        <div className="upcoming-header">
          <h3>Upcoming chores</h3>
          <p className="helper-text">No scheduled chores in the next few days.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="upcoming-panel">
      <div className="upcoming-header">
        <h3>Upcoming chores</h3>
        <p className="helper-text">Showing the next {upcoming.length} scheduled actions</p>
      </div>
      <ul className="upcoming-list">
        {upcoming.map((entry) => (
          <li key={`${entry.taskId}-${entry.dateTime}-${entry.childNames.join("-")}`}>
            <div className="upcoming-row">
              <div>
                <div className="upcoming-task">{entry.taskTitle}</div>
                <div className="upcoming-children">
                  Assigned to {entry.childNames.join(", ")}
                </div>
              </div>
              <div className="upcoming-date">{formatDateTime(entry.dateTime)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default UpcomingTasksPanel;

