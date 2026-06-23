// services/ongoingTaskService.js — Business logic for ongoing tasks.
// Mirrors projectService but without custom columns or due date change tracking.

const taskRepo     = require('../repositories/ongoingTaskRepository');
const { recordStatusChange, setResponsibles, isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

function list(user, { section_id, archived }) {
  const showArchived = archived === '1' ? 1 : 0;
  const sectionId    = user.role === 'section_head' ? user.section_id : section_id;
  return taskRepo.enrich(taskRepo.findAll({ sectionId, showArchived }));
}

function create(user, body) {
  const { title, section_id, responsible_ids, status, note, progress } = body;
  if (!title?.trim()) throw new ServiceError(400, 'Title required');
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  if (!sectionId) throw new ServiceError(400, 'section_id required');

  const initialStatus   = status || 'in_progress';
  const initialProgress = Math.min(100, Math.max(0, Number(progress) || 0));

  const task = taskRepo.create({ title: title.trim(), sectionId, status: initialStatus, note: note || '', progress: initialProgress });
  recordStatusChange('ongoing_task', task.id, null, initialStatus, user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', task.id, responsible_ids);
  return taskRepo.enrich([task])[0];
}

function update(user, id, body) {
  const task = taskRepo.findById(id);
  if (!task) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && task.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }

  const { title, responsible_ids, status, note, progress } = body;
  const newStatus   = status ?? task.status;
  const newProgress = progress != null ? Math.min(100, Math.max(0, Number(progress))) : (task.progress ?? 0);

  const updated = taskRepo.update(id, {
    title:    title    ?? task.title,
    status:   newStatus,
    note:     note     ?? task.note,
    progress: newProgress,
  });
  recordStatusChange('ongoing_task', id, task.status, newStatus, user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('ongoing_task_responsibles', 'task_id', id, responsible_ids);
  return taskRepo.enrich([updated])[0];
}

function archive(user, id, archiveFlag) {
  const task = taskRepo.findById(id);
  if (!task) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && task.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  const archive = archiveFlag === false ? 0 : 1;
  taskRepo.setArchived(id, archive);
  return { ok: true, is_archived: archive };
}

function softDelete(user, id) {
  const task = taskRepo.findById(id);
  if (!task) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && task.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  if (!isWithinDeletionWindow(task.created_at)) throw new ServiceError(409, 'older_than_10_min');
  taskRepo.softDelete(id);
  return { ok: true };
}

function getHistory(id) { return taskRepo.getHistory(id); }

module.exports = { list, create, update, archive, softDelete, getHistory };
