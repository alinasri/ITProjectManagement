// services/projectService.js — Business logic for projects.
//
// This layer sits between routes (HTTP) and repositories (SQL).
// Rules that live here:
//   - section_head users can only access/modify their own section's projects
//   - progress must be clamped to 0–100
//   - due_date changes are recorded in the audit log
//   - deletion is only allowed within 10 minutes of creation

const projectRepo  = require('../repositories/projectRepository');
const { recordStatusChange, recordFieldChange, setResponsibles, isWithinDeletionWindow } = require('../db/helpers');
const ServiceError = require('../utils/serviceError');

// list — returns all projects visible to this user, with responsibles and custom values attached.
function list(user, { section_id, archived }) {
  const showArchived = archived === '1' ? 1 : 0;
  // section_head is always restricted to their own section, regardless of query params.
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  return projectRepo.enrich(projectRepo.findAll({ sectionId, showArchived }));
}

// create — inserts a new project and records the initial status in the audit log.
function create(user, body) {
  const { title, section_id, responsible_ids, status, future_plan, problems, row_order, progress, due_date } = body;
  if (!title?.trim()) throw new ServiceError(400, 'Title required');
  const sectionId = user.role === 'section_head' ? user.section_id : section_id;
  if (!sectionId) throw new ServiceError(400, 'section_id required');

  const initialStatus   = status || 'not_started';
  // Math.min/max clamps any input to the valid 0–100 range before storing.
  const initialProgress = Math.min(100, Math.max(0, Number(progress) || 0));

  const project = projectRepo.create({
    title: title.trim(), sectionId, status: initialStatus,
    future_plan: future_plan || '', problems: problems || '',
    row_order, progress: initialProgress, due_date,
  });

  // fromStatus = null on creation: the project had no previous status.
  recordStatusChange('project', project.id, null, initialStatus, user.id);
  if (Array.isArray(responsible_ids)) setResponsibles('project_responsibles', 'project_id', project.id, responsible_ids);

  // enrich() re-queries responsibles after setResponsibles so the response includes them.
  return projectRepo.enrich([project])[0];
}

// update — applies partial or full changes to a project.
// Any field not included in the request body keeps its current value (??).
function update(user, id, body) {
  const project = projectRepo.findById(id);
  if (!project) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && project.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }

  const { title, responsible_ids, status, future_plan, problems, row_order, custom_values, progress, due_date } = body;
  const newStatus   = status ?? project.status;
  const newProgress = progress != null ? Math.min(100, Math.max(0, Number(progress))) : (project.progress ?? 0);
  // due_date !== undefined: if the key is explicitly in the body (even as ''), update it.
  // If due_date is absent from the body entirely, keep the existing value unchanged.
  const newDueDate  = due_date !== undefined ? (due_date || null) : project.due_date;

  const updated = projectRepo.update(id, {
    title:       title       ?? project.title,
    status:      newStatus,
    future_plan: future_plan ?? project.future_plan,
    problems:    problems    ?? project.problems,
    row_order:   row_order   ?? project.row_order,
    progress:    newProgress,
    due_date:    newDueDate,
  });

  recordStatusChange('project', id, project.status, newStatus, user.id);
  if (newDueDate !== project.due_date) {
    recordFieldChange('project', id, 'due_date', project.due_date, newDueDate, user.id);
  }
  if (Array.isArray(responsible_ids)) setResponsibles('project_responsibles', 'project_id', id, responsible_ids);
  if (Array.isArray(custom_values))   projectRepo.upsertCustomValues(id, custom_values);

  return projectRepo.enrich([updated])[0];
}

// archive — toggles the is_archived flag on a project.
function archive(user, id, archiveFlag) {
  const project = projectRepo.findById(id);
  if (!project) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && project.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  // archiveFlag === false explicitly unarchives; anything else (true, undefined) archives.
  const archive = archiveFlag === false ? 0 : 1;
  projectRepo.setArchived(id, archive);
  return { ok: true, is_archived: archive };
}

// softDelete — marks the project as deleted. Blocked after the 10-minute window.
function softDelete(user, id) {
  const project = projectRepo.findById(id);
  if (!project) throw new ServiceError(404, 'Not found');
  if (user.role === 'section_head' && project.section_id !== user.section_id) {
    throw new ServiceError(403, 'Forbidden');
  }
  if (!isWithinDeletionWindow(project.created_at)) throw new ServiceError(409, 'older_than_10_min');
  projectRepo.softDelete(id);
  return { ok: true };
}

function getHistory(id) { return projectRepo.getHistory(id); }
function getDeadlineChanges() { return projectRepo.getDeadlineChanges(); }

module.exports = { list, create, update, archive, softDelete, getHistory, getDeadlineChanges };
