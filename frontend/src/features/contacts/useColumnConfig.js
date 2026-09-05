import { useState } from 'react';

const STORAGE_KEY = 'contactTableColumns';

export const DEFAULT_COLUMNS = [
  { id: 'checkbox', label: 'Select', visible: true, width: 'min-w-[50px]', draggable: false },
  { id: 'phone', label: 'Phone', visible: true, width: 'min-w-[120px]', draggable: true },
  { id: 'phone2', label: 'Phone 2', visible: false, width: 'min-w-[120px]', draggable: true },
  { id: 'customerName', label: 'Customer Name', visible: true, width: 'min-w-[150px]', draggable: true },
  { id: 'shopName', label: 'Shop Name', visible: true, width: 'min-w-[150px]', draggable: true },
  { id: 'address', label: 'Address', visible: true, width: 'min-w-[200px]', draggable: true },
  { id: 'city', label: 'City', visible: true, width: 'min-w-[100px]', draggable: true },
  { id: 'state', label: 'State', visible: true, width: 'min-w-[80px]', draggable: true },
  { id: 'assignedStaff', label: 'Assigned Staff', visible: true, width: 'min-w-[150px]', draggable: true },
  { id: 'status', label: 'Status', visible: true, width: 'min-w-[120px]', draggable: true },
  { id: 'category', label: 'Category', visible: true, width: 'min-w-[150px]', draggable: true },
  { id: 'actions', label: 'Actions', visible: true, width: 'min-w-[100px]', draggable: false },
];

function loadColumnConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults for backward compatibility (a new column added
      // later shouldn't be silently missing for users with an old saved config).
      return DEFAULT_COLUMNS.map((defaultCol) => {
        const savedCol = parsed.find((c) => c.id === defaultCol.id);
        return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
      });
    }
  } catch (err) {
    console.error('Error loading column config:', err);
  }
  return DEFAULT_COLUMNS;
}

function persist(columns) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (err) {
    console.error('Error saving column config:', err);
  }
}

// Extracted from the old ContactsView (~90 lines of localStorage +
// drag-drop column state) into a standalone, testable hook.
export function useColumnConfig() {
  const [columns, setColumns] = useState(loadColumnConfig);
  const [draggedColumn, setDraggedColumn] = useState(null);

  const toggleVisibility = (columnId) => {
    const next = columns.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col));
    setColumns(next);
    persist(next);
  };

  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    const draggedIndex = columns.findIndex((col) => col.id === draggedColumn);
    const targetIndex = columns.findIndex((col) => col.id === targetColumnId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const next = [...columns];
    const [draggedItem] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, draggedItem);

    setColumns(next);
    persist(next);
    setDraggedColumn(null);
  };

  const reset = () => {
    setColumns(DEFAULT_COLUMNS);
    persist(DEFAULT_COLUMNS);
  };

  const visibleColumns = columns.filter((col) => col.visible);

  return {
    columns,
    visibleColumns,
    draggedColumn,
    toggleVisibility,
    handleDragStart,
    handleDragOver,
    handleDrop,
    reset,
  };
}
