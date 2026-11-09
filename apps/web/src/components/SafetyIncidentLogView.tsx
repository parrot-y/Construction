import React, { useEffect, useState} from 'react';

export interface SafetyIncident {
  id: string;
  incident_date: string;
  location_on_site: string;
  incident_type: 'NEAR_MISS' | 'FIRST_AID' | 'MEDICAL_TREATMENT' | 'LOST_TIME_INJURY' | 'FATALITY' | 'PROPERTY_DAMAGE' | 'PPE_VIOLATION' | 'STRUCK_BY_EQUIPMENT' | 'EQUIPMENT_ROLLOVER' | 'CAVE_IN_TRENCH' | 'TRAFFIC_INCIDENT' | 'ASPHALT_HOT_MATERIAL' | 'ENVIRONMENTAL_RELEASE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affected_person?: string | null;
  immediate_action?: string | null;
  corrective_action?: string | null;
  is_osha_reportable: boolean;
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'CORRECTED' | 'CLOSED';
  recorded_by?: { full_name: string} | null;
  reported_at: string;
}

interface SafetyIncidentLogViewProps {
  projectId: string;
  canLog?: boolean;
  canInvestigate?: boolean;
  initialIncidents?: SafetyIncident[];
  onIncidentLogged?: (incident: Partial<SafetyIncident>) => void;
  onStatusUpdated?: (incidentId: string, status: SafetyIncident['status']) => void;
}

export default function SafetyIncidentLogView({
  projectId,
  canLog = true,
  canInvestigate = true,
  initialIncidents,
  onIncidentLogged,
  onStatusUpdated,
}: SafetyIncidentLogViewProps) {
  const [incidents, setIncidents] = useState<SafetyIncident[]>(initialIncidents ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/safety-incidents`, { credentials: 'include'});
      if (!res.ok) throw new Error('Failed to load safety incidents');
      const body = await res.json();
      const sevMap: Record<string, SafetyIncident['severity']> = { MINOR: 'LOW', MODERATE: 'MEDIUM', SERIOUS: 'HIGH', CRITICAL: 'CRITICAL' };
      setIncidents((body.incidents || []).map((i: any): SafetyIncident => ({
        id: i.id,
        incident_date: i.incident_date,
        location_on_site: i.exact_location,
        incident_type: i.incident_type,
        severity: sevMap[i.severity] || 'MEDIUM',
        description: i.description,
        affected_person: i.affected_person_name,
        immediate_action: i.immediate_action,
        corrective_action: i.preventative_action,
        is_osha_reportable: !!i.is_osha_reportable,
        status: 'OPEN',
        recorded_by: { full_name: i.investigated_by || 'Site team' },
        reported_at: i.created_at,
      })));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load safety incidents');
    }
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [newLocation, setNewLocation] = useState<string>('');
  const [newType, setNewType] = useState<SafetyIncident['incident_type']>('NEAR_MISS');
  const [newSeverity, setNewSeverity] = useState<SafetyIncident['severity']>('LOW');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newAffected, setNewAffected] = useState<string>('');
  const [newImmediate, setNewImmediate] = useState<string>('');
  const [newCorrective, setNewCorrective] = useState<string>('');
  const [newOsha, setNewOsha] = useState<boolean>(false);

  const filtered = incidents.filter((i) => {
    const matchesType = typeFilter === 'ALL' || i.incident_type === typeFilter;
    const matchesSev = severityFilter === 'ALL' || i.severity === severityFilter;
    return matchesType && matchesSev;
});

  const totalIncidents = incidents.length;
  const nearMisses = incidents.filter((i) => i.incident_type === 'NEAR_MISS').length;
  const lostTimeCount = incidents.filter((i) => i.incident_type === 'LOST_TIME_INJURY').length;
  const oshaReportableCount = incidents.filter((i) => i.is_osha_reportable).length;

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.trim() || !newDescription.trim()) return;

    const created: SafetyIncident = {
      id: `inc-${Date.now()}`,
      incident_date: new Date(newDate).toISOString(),
      location_on_site: newLocation.trim(),
      incident_type: newType,
      severity: newSeverity,
      description: newDescription.trim(),
      affected_person: newAffected.trim() || null,
      immediate_action: newImmediate.trim() || null,
      corrective_action: newCorrective.trim() || null,
      is_osha_reportable: newOsha,
      status: 'OPEN',
      reported_at: new Date().toISOString(),
      recorded_by: { full_name: 'Site HSE Officer'},
};

    setIncidents([created, ...incidents]);
    if (onIncidentLogged) onIncidentLogged(created);
    setShowModal(false);
    setNewLocation('');
    setNewDescription('');
    setNewAffected('');
    setNewImmediate('');
    setNewCorrective('');
    setNewOsha(false);
};

  const handleStatusChange = (incidentId: string, status: SafetyIncident['status']) => {
    setIncidents(
      incidents.map((i) => (i.id === incidentId ? { ...i, status} : i))
);
    if (onStatusUpdated) onStatusUpdated(incidentId, status);
};

  const getSeverityBadge = (sev: SafetyIncident['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return<span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-600 text-white">CRITICAL</span>;
      case 'HIGH':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">HIGH</span>;
      case 'MEDIUM':
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">MEDIUM</span>;
      default:
        return<span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">LOW</span>;
}
};

  return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" data-testid="safety-incident-log-view" data-project-id={projectId}>
      {/* Header & KPI Summary */}
<div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
<div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800">
                OSHA 2007 &amp; NCA
</span>
<h2 className="text-xl font-bold text-slate-900">Safety, Health &amp; Environment (HSE) Register</h2>
</div>
<p className="text-sm text-slate-500 mt-1">
              Statutory incident logging, CAPA corrective actions, and DOSHS compliance.
</p>
</div>
          {canLog && (
<button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-rose-600 hover:bg-rose-700 shadow-sm"
            >
               Log Safety Incident
</button>
)}
</div>

        {/* 4 Metric Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Total Logged Incidents</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-slate-900">{totalIncidents}</span>
<span className="text-xs text-slate-400">cases</span>
</div>
<div className="text-xs text-slate-500 mt-2">All time on site</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Near Misses Logged</span>
<div className="mt-1 flex items-baseline gap-2">
<span className="text-2xl font-bold text-amber-600">{nearMisses}</span>
<span className="text-xs text-slate-400">proactive</span>
</div>
<div className="text-xs text-slate-500 mt-2">Hazard identification</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">Lost Time Injuries (LTI)</span>
<div className="mt-1 flex items-baseline gap-2">
<span className={`text-2xl font-bold ${lostTimeCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {lostTimeCount}
</span>
<span className="text-xs text-slate-400">LTI</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              {lostTimeCount === 0 ? 'Zero Harm achieved' : 'LTI investigation open'}
</div>
</div>

<div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
<span className="text-xs text-slate-500 font-medium">OSHA 2007 Reportable</span>
<div className="mt-1 flex items-baseline gap-2">
<span className={`text-2xl font-bold ${oshaReportableCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {oshaReportableCount}
</span>
<span className="text-xs text-slate-400">to DOSHS</span>
</div>
<div className="text-xs text-slate-500 mt-2">
              {oshaReportableCount === 0 ? 'No statutory filing needed' : 'DOSHS notice filed'}
</div>
</div>
</div>
</div>

      {/* Filter Bar */}
<div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-3">
<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Type:</label>
<select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
<option value="ALL">All Incident Types</option>
<option value="NEAR_MISS">Near Miss</option>
<option value="FIRST_AID">First Aid Case</option>
<option value="MEDICAL_TREATMENT">Medical Treatment Case</option>
<option value="LOST_TIME_INJURY">Lost Time Injury (LTI)</option>
<option value="FATALITY">Fatality</option>
<option value="PROPERTY_DAMAGE">Equipment / Plant Damage</option>
<option value="PPE_VIOLATION">PPE Violation</option>
<option value="STRUCK_BY_EQUIPMENT">Struck by Equipment</option>
<option value="EQUIPMENT_ROLLOVER">Equipment Rollover</option>
<option value="CAVE_IN_TRENCH">Cave-in / Trench Collapse</option>
<option value="TRAFFIC_INCIDENT">Traffic Incident</option>
<option value="ASPHALT_HOT_MATERIAL">Asphalt Burn / Hot Material</option>
<option value="ENVIRONMENTAL_RELEASE">Environmental Release</option>
</select>
</div>

<div className="flex items-center gap-2">
<label className="text-xs font-semibold text-slate-600 ">Severity:</label>
<select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
<option value="ALL">All Severities</option>
<option value="LOW">Low</option>
<option value="MEDIUM">Medium</option>
<option value="HIGH">High</option>
<option value="CRITICAL">Critical</option>
</select>
</div>
</div>

      {loadError && (
<div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">{loadError}</div>
)}

      {/* Incident List */}
<div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
<div className="p-8 text-center text-slate-500 text-sm">
            No safety incidents logged matching selected criteria. Site safety record is clean.
</div>
) : (
          filtered.map((item) => (
<div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
<div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
<div className="flex-1 min-w-0">
<div className="flex flex-wrap items-center gap-2 mb-2">
<span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {item.incident_type.replace('_', ' ')}
</span>
                    {getSeverityBadge(item.severity)}
                    {item.is_osha_reportable && (
<span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-700 text-white animate-pulse">
                         OSHA 2007 REPORTABLE
</span>
)}
<span className="text-xs text-slate-400">
                      • {new Date(item.incident_date).toLocaleString()}
</span>
</div>

<h4 className="text-sm font-bold text-slate-900 mb-1">
                     {item.location_on_site}
</h4>

<p className="text-xs text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
<strong className="text-slate-800">Description:</strong> {item.description}
</p>

                  {item.affected_person && (
<div className="text-xs text-slate-600 mb-2">
<strong className="text-slate-700">Affected Personnel:</strong> {item.affected_person}
</div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-200">
<div>
<strong className="text-emerald-700">Immediate Action Taken:</strong>
<p className="text-slate-600 mt-0.5">{item.immediate_action || 'None recorded'}</p>
</div>
<div>
<strong className="text-indigo-700">Corrective &amp; Preventive Action (CAPA):</strong>
<p className="text-slate-600 mt-0.5">{item.corrective_action || 'Pending investigation'}</p>
</div>
</div>
</div>

                {/* Status & Actions */}
<div className="lg:w-48 flex flex-col items-start lg:items-end justify-between self-stretch">
<div className="text-right">
<span className="text-xs text-slate-400 block mb-1">Investigation Status</span>
                    {canInvestigate ? (
<select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                        className="text-xs font-semibold border border-slate-300 rounded px-2.5 py-1 bg-white text-slate-800 focus:outline-none"
                      >
<option value="OPEN">Open</option>
<option value="UNDER_INVESTIGATION">Under Investigation</option>
<option value="CORRECTED">Corrected</option>
<option value="CLOSED">Closed &amp; Signed Off</option>
</select>
) : (
<span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                        {item.status}
</span>
)}
</div>

                  {item.recorded_by && (
<div className="text-[11px] text-slate-400 mt-4 text-right">
                      Logged by:<span className="text-slate-600">{item.recorded_by.full_name}</span>
</div>
)}
</div>
</div>
</div>
))
)}
</div>

      {/* Incident Form Modal */}
      {showModal && (
<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
<div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
<h3 className="text-lg font-bold text-slate-900 mb-1">Log Safety / HSE Incident</h3>
<p className="text-xs text-slate-500 mb-4">
              Permanent statutory record under Kenya OSHA 2007 and NCA building safety code.
</p>
<form onSubmit={handleCreateIncident} className="space-y-3">
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Date &amp; Time</label>
<input
                    type="datetime-local"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
<select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
<option value="LOW">Low (Minor cut, no lost time)</option>
<option value="MEDIUM">Medium (First aid / near hazard)</option>
<option value="HIGH">High (Hospitalization / severe damage)</option>
<option value="CRITICAL">Critical (Life-threatening / structural failure)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Incident Classification</label>
<select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
<option value="NEAR_MISS">Near Miss</option>
<option value="FIRST_AID">First Aid Case</option>
<option value="MEDICAL_TREATMENT">Medical Treatment</option>
<option value="LOST_TIME_INJURY">Lost Time Injury</option>
<option value="FATALITY">Fatality</option>
<option value="PROPERTY_DAMAGE">Property / Machinery Damage</option>
<option value="PPE_VIOLATION">PPE Violation</option>
<option value="STRUCK_BY_EQUIPMENT">Struck by Equipment</option>
<option value="EQUIPMENT_ROLLOVER">Equipment Rollover</option>
<option value="CAVE_IN_TRENCH">Cave-in / Trench Collapse</option>
<option value="TRAFFIC_INCIDENT">Traffic Incident</option>
<option value="ASPHALT_HOT_MATERIAL">Asphalt Burn / Hot Material</option>
<option value="ENVIRONMENTAL_RELEASE">Environmental Release</option>
</select>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Location On Site</label>
<input
                    type="text"
                    required
                    placeholder="e.g. Scaffolding Grid C-2"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Affected Personnel (if any)</label>
<input
                  type="text"
                  placeholder="e.g. Samuel Mutua (Fundi mason)"
                  value={newAffected}
                  onChange={(e) => setNewAffected(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Incident Description &amp; Circumstances</label>
<textarea
                  rows={2}
                  required
                  placeholder="Detailed narrative of what transpired..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Immediate Action</label>
<input
                    type="text"
                    placeholder="e.g. First aid applied, area cordoned"
                    value={newImmediate}
                    onChange={(e) => setNewImmediate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 mb-1">Corrective Action (CAPA)</label>
<input
                    type="text"
                    placeholder="e.g. Retraining, equipment repair"
                    value={newCorrective}
                    onChange={(e) => setNewCorrective(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  />
</div>
</div>

<div className="pt-2">
<label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
<input
                    type="checkbox"
                    checked={newOsha}
                    onChange={(e) => setNewOsha(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
<span>Mandatory OSHA 2007 reportable to Directorate of Occupational Safety (DOSHS)?</span>
</label>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  Save Incident Entry
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
}
