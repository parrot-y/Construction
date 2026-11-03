import React, { useState } from 'react';

export interface ScheduleTask {
  id: string;
  wbs_phase: string;
  task_name: string;
  description?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  duration_days: number;
  progress_percentage: string | number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'BLOCKED';
  assigned_trade?: string | null;
  order_index: number;
}

interface ProjectScheduleGanttViewProps {
  projectId: string;
  canEdit?: boolean;
  initialTasks?: ScheduleTask[];
  onTaskCreated?: (task: Partial<ScheduleTask>) => void;
  onTaskUpdated?: (taskId: string, updates: Partial<ScheduleTask>) => void;
}

export default function ProjectScheduleGanttView({
  projectId,
  canEdit = true,
  initialTasks = [
    {
      id: 'task-1',
      wbs_phase: 'SUBSTRUCTURE',
      task_name: 'Site Clearance & Bulk Excavation',
      description: 'Excavation to formation level and disposal of surplus material',
      planned_start_date: '2026-03-01',
      planned_end_date: '2026-03-12',
      actual_start_date: '2026-03-01',
      actual_end_date: '2026-03-11',
      duration_days: 12,
      progress_percentage: 100,
      status: 'COMPLETED',
      assigned_trade: 'Plant Operators & Casuals',
      order_index: 1,
    },
    {
      id: 'task-2',
      wbs_phase: 'SUBSTRUCTURE',
      task_name: 'Reinforced Concrete Foundation Footings',
      description: 'Y16/Y12 rebar placement and C25 vibrated mass foundation pour',
      planned_start_date: '2026-03-13',
      planned_end_date: '2026-03-24',
      actual_start_date: '2026-03-14',
      duration_days: 12,
      progress_percentage: 75,
      status: 'IN_PROGRESS',
      assigned_trade: 'Steel Fixers & Masons',
      order_index: 2,
    },
    {
      id: 'task-3',
      wbs_phase: 'SUPERSTRUCTURE',
      task_name: 'Ground Floor Columns & Suspended Slab Formwork',
      description: 'Marine ply formwork shuttering with adjustable steel props',
      planned_start_date: '2026-03-25',
      planned_end_date: '2026-04-10',
      duration_days: 17,
      progress_percentage: 15,
      status: 'IN_PROGRESS',
      assigned_trade: 'Carpenters & Scaffolding',
      order_index: 3,
    },
    {
      id: 'task-4',
      wbs_phase: 'MEP_SERVICES',
      task_name: 'Conduit Reticulation & First Fix Electrical',
      description: 'Drop conduits into deck before slab casting per electrical layout',
      planned_start_date: '2026-04-05',
      planned_end_date: '2026-04-12',
      duration_days: 8,
      progress_percentage: 0,
      status: 'PLANNED',
      assigned_trade: 'Electricians',
      order_index: 4,
    },
  ],
  onTaskCreated,
  onTaskUpdated,
}: ProjectScheduleGanttViewProps) {
  const [tasks, setTasks] = useState<ScheduleTask[]>(initialTasks);
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [newPhase, setNewPhase] = useState<string>('SUBSTRUCTURE');
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [newDuration, setNewDuration] = useState<number>(7);
  const [newTrade, setNewTrade] = useState<string>('');

  const filteredTasks = tasks.filter((t) => {
    const matchesPhase = phaseFilter === 'ALL' || t.wbs_phase === phaseFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesPhase && matchesStatus;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const delayedTasks = tasks.filter((t) => t.status === 'DELAYED').length;
  const overallProgress = totalTasks > 0
    ? Math.round(tasks.reduce((sum, t) => sum + Number(t.progress_percentage || 0), 0) / totalTasks)
    : 0;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newStartDate || !newEndDate) return;

    const newTask: ScheduleTask = {
      id: `task-${Date.now()}`,
      wbs_phase: newPhase,
      task_name: newTaskName.trim(),
      description: newDesc.trim() || null,
      planned_start_date: newStartDate,
      planned_end_date: newEndDate,
      duration_days: newDuration,
      progress_percentage: 0,
      status: 'PLANNED',
      assigned_trade: newTrade.trim() || 'General Masons',
      order_index: tasks.length + 1,
    };

    setTasks([...tasks, newTask]);
    if (onTaskCreated) onTaskCreated(newTask);
    setShowModal(false);
    setNewTaskName('');
    setNewDesc('');
  };

  const handleUpdateProgress = (taskId: string, newProgress: number) => {
    const nextStatus = newProgress === 100 ? 'COMPLETED' : newProgress > 0 ? 'IN_PROGRESS' : 'PLANNED';
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, progress_percentage: newProgress, status: nextStatus }
          : t
      )
    );
    if (onTaskUpdated) {
      onTaskUpdated(taskId, { progress_percentage: newProgress, status: nextStatus });
    }
  };

  const getStatusBadge = (status: ScheduleTask['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Completed</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">In Progress</span>;
      case 'DELAYED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Delayed</span>;
      case 'BLOCKED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Blocked</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">Planned</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="project-schedule-gantt-view" data-project-id={projectId}>
      {/* Header & KPI Summary */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                WBS &amp; GANTT
              </span>
              <h2 className="text-xl font-bold text-slate-900">Project Master Schedule</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Phased activity tracking, planned vs. actual timelines, and trade crew allocations.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              + Add Schedule Task
            </button>
          )}
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Overall Progress</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{overallProgress}%</span>
              <span className="text-xs text-slate-400">weighted avg</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${overallProgress}%` }}></div>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Total Milestones</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalTasks}</span>
              <span className="text-xs text-slate-400">tasks</span>
            </div>
            <div className="text-xs text-emerald-600 mt-2 font-medium">
              {completedTasks} completed
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Active In-Progress</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">{inProgressTasks}</span>
              <span className="text-xs text-slate-400">on site</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Executing trades
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Schedule Variance</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${delayedTasks > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {delayedTasks}
              </span>
              <span className="text-xs text-slate-400">delayed</span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {delayedTasks === 0 ? 'On program track' : 'Action required'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Phase:</label>
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All WBS Phases</option>
            <option value="SUBSTRUCTURE">Substructure</option>
            <option value="SUPERSTRUCTURE">Superstructure</option>
            <option value="ROOFING">Roofing</option>
            <option value="MEP_SERVICES">MEP Services</option>
            <option value="FINISHES">Finishes &amp; Joinery</option>
            <option value="EXTERNAL_WORKS">External Works &amp; Civil</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="DELAYED">Delayed</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
      </div>

      {/* Task List / Gantt Timeline View */}
      <div className="divide-y divide-slate-100">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No schedule tasks found matching the selected filters.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div key={task.id} className="p-4 hover:bg-slate-50/80 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {task.wbs_phase}
                    </span>
                    {getStatusBadge(task.status)}
                    <span className="text-xs text-slate-400">
                      • {task.duration_days} days
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {task.task_name}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {task.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span>
                      📅 <strong className="text-slate-700">Planned:</strong> {task.planned_start_date} → {task.planned_end_date}
                    </span>
                    {task.actual_start_date && (
                      <span>
                        ⏱️ <strong className="text-slate-700">Actual Start:</strong> {task.actual_start_date}
                      </span>
                    )}
                    {task.assigned_trade && (
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        🔨 {task.assigned_trade}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Control */}
                <div className="lg:w-64 flex flex-col justify-center">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Progress</span>
                    <span>{task.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        Number(task.progress_percentage) === 100
                          ? 'bg-emerald-500'
                          : Number(task.progress_percentage) > 50
                          ? 'bg-indigo-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${task.progress_percentage}%` }}
                    ></div>
                  </div>
                  {canEdit && (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={task.progress_percentage}
                      onChange={(e) => handleUpdateProgress(task.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-200 rounded"
                      aria-label={`Update progress for ${task.task_name}`}
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create Schedule Milestone Task</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a work breakdown activity to the site master program.
            </p>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WBS Phase</label>
                <select
                  value={newPhase}
                  onChange={(e) => setNewPhase(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="SUBSTRUCTURE">Substructure (Excavation &amp; Footings)</option>
                  <option value="SUPERSTRUCTURE">Superstructure (Columns &amp; Slabs)</option>
                  <option value="ROOFING">Roofing &amp; Truss Fabrication</option>
                  <option value="MEP_SERVICES">MEP Services (Electrical &amp; Plumbing)</option>
                  <option value="FINISHES">Finishes, Plaster &amp; Joinery</option>
                  <option value="EXTERNAL_WORKS">External Works &amp; Drainage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ring beam reinforcement and casting"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Technical scope, specifications, or location notes..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Planned Start</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Planned End</label>
                  <input
                    type="date"
                    required
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Trade Crew</label>
                  <input
                    type="text"
                    placeholder="e.g. Masons &amp; Fundis"
                    value={newTrade}
                    onChange={(e) => setNewTrade(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
