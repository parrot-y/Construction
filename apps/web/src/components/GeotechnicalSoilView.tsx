import React, { useEffect, useState} from 'react';

export interface SoilTestRecord {
  id: string;
  testNumber: string;
  testDate: string;
  locationElement: string;
  layerType: 'SUBGRADE' | 'SUBBASE' | 'BASE_COURSE' | 'FOUNDATION_PAD' | 'EMBANKMENT_FILL';
  testMethod: 'SAND_REPLACEMENT' | 'NUCLEAR_GAUGE' | 'CORE_CUTTER';
  laboratoryMddGCm3: string;
  laboratoryOmcPercent: string;
  fieldWetDensityGCm3: string;
  fieldMoisturePercent: string;
  fieldDryDensityGCm3: string;
  relativeCompactionPercent: string;
  requiredCompactionPercent: string;
  dcpBlowsPer100mm?: number | null;
  estimatedCbrPercent?: string | null;
  qaVerdict: 'PASS' | 'FAIL_LOW_COMPACTION' | 'FAIL_MOISTURE_EXCESS' | 'FAIL_MOISTURE_DEFICIT';
  status: 'VERIFIED' | 'RE_COMPACTION_REQUIRED';
  inspectedBy: string;
}

interface GeotechnicalSoilViewProps {
  projectId: string;
  projectName?: string;
  initialTests?: SoilTestRecord[];
  onRecordTest?: (test: any) => Promise<void>;
}

const DEFAULT_SOIL_TESTS: SoilTestRecord[] = [
  {
    id: 'st-001',
    testNumber: 'SOIL-CMP-001',
    testDate: new Date(Date.now() - 2 * 3600000).toISOString(),
    locationElement: 'Subbase Section Ch 1+200 - 1+450 Main Carriageway',
    layerType: 'SUBBASE',
    testMethod: 'SAND_REPLACEMENT',
    laboratoryMddGCm3: '2.150',
    laboratoryOmcPercent: '9.50',
    fieldWetDensityGCm3: '2.260',
    fieldMoisturePercent: '10.00',
    fieldDryDensityGCm3: '2.055',
    relativeCompactionPercent: '95.58',
    requiredCompactionPercent: '95.00',
    dcpBlowsPer100mm: 18,
    estimatedCbrPercent: '46.50',
    qaVerdict: 'PASS',
    status: 'VERIFIED',
    inspectedBy: 'Eng. Francis Kimani (Resident Materials Eng)',
},
  {
    id: 'st-002',
    testNumber: 'SOIL-CMP-002',
    testDate: new Date(Date.now() - 5 * 3600000).toISOString(),
    locationElement: 'Building Pad Column Footings Grid C1-C6',
    layerType: 'FOUNDATION_PAD',
    testMethod: 'SAND_REPLACEMENT',
    laboratoryMddGCm3: '2.200',
    laboratoryOmcPercent: '8.80',
    fieldWetDensityGCm3: '2.320',
    fieldMoisturePercent: '9.10',
    fieldDryDensityGCm3: '2.126',
    relativeCompactionPercent: '96.64',
    requiredCompactionPercent: '98.00',
    dcpBlowsPer100mm: 14,
    estimatedCbrPercent: '34.20',
    qaVerdict: 'FAIL_LOW_COMPACTION',
    status: 'RE_COMPACTION_REQUIRED',
    inspectedBy: 'John Kiprono (QA Inspector)',
},
  {
    id: 'st-003',
    testNumber: 'SOIL-CMP-003',
    testDate: new Date(Date.now() - 24 * 3600000).toISOString(),
    locationElement: 'Embankment Fill Slope Ch 0+800 LHS',
    layerType: 'EMBANKMENT_FILL',
    testMethod: 'NUCLEAR_GAUGE',
    laboratoryMddGCm3: '1.980',
    laboratoryOmcPercent: '12.00',
    fieldWetDensityGCm3: '2.180',
    fieldMoisturePercent: '15.80',
    fieldDryDensityGCm3: '1.883',
    relativeCompactionPercent: '95.10',
    requiredCompactionPercent: '90.00',
    qaVerdict: 'FAIL_MOISTURE_EXCESS',
    status: 'RE_COMPACTION_REQUIRED',
    inspectedBy: 'Sarah Njeri (Lab Tech)',
},
];

export const GeotechnicalSoilView: React.FC<GeotechnicalSoilViewProps> = ({
  projectId,
  projectName = 'Kilimani Commercial Complex',
  initialTests = import.meta.env.DEV ? DEFAULT_SOIL_TESTS : [],
  onRecordTest,
}) => {
  const [tests, setTests] = useState<SoilTestRecord[]>(initialTests);
  const [filterLayer, setFilterLayer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [testNumber, setTestNumber] = useState(`SOIL-CMP-${Date.now().toString().slice(-4)}`);
  const [locationElement, setLocationElement] = useState('');
  const [layerType, setLayerType] = useState<SoilTestRecord['layerType']>('SUBBASE');
  const [testMethod, setTestMethod] = useState<SoilTestRecord['testMethod']>('SAND_REPLACEMENT');
  const [labMdd, setLabMdd] = useState('2.150');
  const [labOmc, setLabOmc] = useState('9.50');
  const [fieldWetDensity, setFieldWetDensity] = useState('2.260');
  const [fieldMoisture, setFieldMoisture] = useState('10.00');
  const [requiredCompaction, setRequiredCompaction] = useState('95.00');
  const [dcpBlows, setDcpBlows] = useState<number | undefined>(18);
  const [inspectorName, setInspectorName] = useState('Site QA Engineer');

  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/soil-tests`, { credentials: 'include'});
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      const list = (json.tests || []) as any[];
      setTests(list.map((t) => ({
        id: t.id,
        testNumber: t.testNumber,
        testDate: t.testDate,
        locationElement: t.locationElement,
        layerType: t.layerType,
        testMethod: t.testMethod,
        laboratoryMddGCm3: t.laboratoryMddGCm3 ?? '0.000',
        laboratoryOmcPercent: t.laboratoryOmcPercent ?? '0.00',
        fieldWetDensityGCm3: t.fieldWetDensityGCm3 ?? '0.000',
        fieldMoisturePercent: t.fieldMoisturePercent ?? '0.00',
        fieldDryDensityGCm3: t.fieldDryDensityGCm3 ?? '0.000',
        relativeCompactionPercent: t.relativeCompactionPercent,
        requiredCompactionPercent: t.requiredCompactionPercent,
        dcpBlowsPer100mm: t.dcpBlowsPer100mm ?? null,
        estimatedCbrPercent: t.estimatedCbrPercent ?? null,
        qaVerdict: t.qaVerdict,
        status: t.status,
        inspectedBy: t.inspectedBy,
})));
} catch {
      setTests([]);
} finally {
      setLiveLoaded(true);
}
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Live form calculation
  const calculateFormMetrics = () => {
    const wet = parseFloat(fieldWetDensity) || 0;
    const w = parseFloat(fieldMoisture) || 0;
    const mdd = parseFloat(labMdd) || 1;
    const dry = wet / (1 + w / 100);
    const rc = (dry / mdd) * 100;
    const req = parseFloat(requiredCompaction) || 95;
    const omc = parseFloat(labOmc) || 0;
    const deltaW = w - omc;

    let verdict: SoilTestRecord['qaVerdict'] = 'PASS';
    if (rc< req) verdict = 'FAIL_LOW_COMPACTION';
    else if (deltaW > 2.5) verdict = 'FAIL_MOISTURE_EXCESS';
    else if (deltaW< -3.0) verdict = 'FAIL_MOISTURE_DEFICIT';

    return {
      dryDensity: dry.toFixed(3),
      rc: rc.toFixed(2),
      deltaW: deltaW.toFixed(2),
      verdict,
};
};

  const formMetrics = calculateFormMetrics();

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const newRecord: SoilTestRecord = {
        id: `st-${Date.now()}`,
        testNumber,
        testDate: new Date().toISOString(),
        locationElement,
        layerType,
        testMethod,
        laboratoryMddGCm3: parseFloat(labMdd).toFixed(3),
        laboratoryOmcPercent: parseFloat(labOmc).toFixed(2),
        fieldWetDensityGCm3: parseFloat(fieldWetDensity).toFixed(3),
        fieldMoisturePercent: parseFloat(fieldMoisture).toFixed(2),
        fieldDryDensityGCm3: formMetrics.dryDensity,
        relativeCompactionPercent: formMetrics.rc,
        requiredCompactionPercent: parseFloat(requiredCompaction).toFixed(2),
        dcpBlowsPer100mm: dcpBlows || null,
        estimatedCbrPercent: dcpBlows && dcpBlows > 0 ? (410 / Math.pow(100 / dcpBlows, 1.27)).toFixed(2) : null,
        qaVerdict: formMetrics.verdict,
        status: formMetrics.verdict === 'PASS' ? 'VERIFIED' : 'RE_COMPACTION_REQUIRED',
        inspectedBy: inspectorName,
};

      if (isLive) {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/soil-tests`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              testNumber: newRecord.testNumber,
              testDate: newRecord.testDate,
              locationElement: newRecord.locationElement,
              layerType: newRecord.layerType,
              testMethod: newRecord.testMethod,
              laboratoryMddGCm3: newRecord.laboratoryMddGCm3,
              laboratoryOmcPercent: newRecord.laboratoryOmcPercent,
              fieldWetDensityGCm3: newRecord.fieldWetDensityGCm3,
              fieldMoisturePercent: newRecord.fieldMoisturePercent,
              requiredCompactionPercent: newRecord.requiredCompactionPercent,
              dcpBlowsPer100mm: newRecord.dcpBlowsPer100mm,
              inspectedBy: newRecord.inspectedBy,
}),
});
          if (res.ok) {
            await reload();
            setShowAddModal(false);
            setLocationElement('');
            return;
}
} catch { /* fall through to local */}
}

      if (onRecordTest) {
        await onRecordTest(newRecord);
}

      setTests([newRecord, ...tests]);
      setShowAddModal(false);
      setLocationElement('');
} catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit soil test to server');
} finally {
      setIsSubmitting(false);
}
};

  const getVerdictBadge = (verdict: SoilTestRecord['qaVerdict']) => {
    switch (verdict) {
      case 'PASS':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"> PASS (Compliant)</span>;
      case 'FAIL_LOW_COMPACTION':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300"> Under-Compacted</span>;
      case 'FAIL_MOISTURE_EXCESS':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"> Spongy (Excess Moisture)</span>;
      case 'FAIL_MOISTURE_DEFICIT':
        return<span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300"> Dry/Brittle Deficit</span>;
}
};

  const filteredTests = tests.filter((t) => {
    const matchesLayer = filterLayer === 'ALL' || t.layerType === filterLayer;
    const matchesSearch =
      t.testNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.locationElement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.inspectedBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLayer && matchesSearch;
});

  const totalTests = tests.length;
  const passedTests = tests.filter((t) => t.qaVerdict === 'PASS').length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '100.0';

  if (isLive && !liveLoaded) {
    return<div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Loading soil tests...</div>;
}

  return (
<div className="space-y-6">
      {/* Header and Action */}
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
<div>
<h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
<span></span> Geotechnical Soil Compaction QA Engine
</h2>
<p className="text-xs text-gray-500 mt-1">
            BS 1377 / BS 5930 / ASTM D1557 Proctor Density, Relative Compaction (RC %) &amp; DCP California Bearing Ratio (CBR %) • {projectName}
</p>
</div>
<button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
        >
          + Log Field Compaction Test
</button>
</div>

      {/* KPI Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Total Tests Logged</span>
<p className="text-2xl font-bold text-gray-900 mt-1">{totalTests}</p>
<span className="text-xs text-gray-400">All earthwork layers</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Compaction Pass Rate</span>
<p className="text-2xl font-bold text-emerald-600 mt-1">{passRate}%</p>
<span className="text-xs text-emerald-500">{passedTests} of {totalTests} verified</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Re-Rolling Required</span>
<p className="text-2xl font-bold text-red-600 mt-1">{totalTests - passedTests}</p>
<span className="text-xs text-red-500">Failed density / moisture</span>
</div>
<div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
<span className="text-xs font-medium text-gray-500 ">Kenya Road Standard (KS 02-102)</span>
<p className="text-2xl font-bold text-blue-600 mt-1">≥95% RC</p>
<span className="text-xs text-blue-500">Subbase (≥98% Pad / Base)</span>
</div>
</div>

      {/* Filters and Search */}
<div className="flex flex-col sm:flex-row gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 items-center justify-between">
<div className="flex gap-2 w-full sm:w-auto">
<select
            value={filterLayer}
            onChange={(e) => setFilterLayer(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2"
          >
<option value="ALL">All Earthwork Layers</option>
<option value="SUBGRADE">Subgrade (Natural / Improved)</option>
<option value="SUBBASE">Subbase (GCI / Natural Gravel)</option>
<option value="BASE_COURSE">Base Course (Dense Bitumen / Crusher Run)</option>
<option value="FOUNDATION_PAD">Foundation Pad (Engineered Fill)</option>
<option value="EMBANKMENT_FILL">Embankment Fill</option>
</select>
</div>
<div className="w-full sm:w-72">
<input
            type="text"
            placeholder="Search test no, location, inspector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg px-3 py-2"
          />
</div>
</div>

      {/* Soil Tests Table */}
<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 text-sm text-left">
<thead className="bg-gray-50 text-gray-600 font-semibold text-xs ">
<tr>
<th scope="col" className="px-4 py-3">Test No &amp; Date</th>
<th scope="col" className="px-4 py-3">Location &amp; Layer</th>
<th scope="col" className="px-4 py-3">Proctor Lab Target</th>
<th scope="col" className="px-4 py-3">Field Measurements</th>
<th scope="col" className="px-4 py-3">Compaction (RC %)</th>
<th scope="col" className="px-4 py-3">DCP / Est. CBR</th>
<th scope="col" className="px-4 py-3">QA Verdict</th>
<th scope="col" className="px-4 py-3">Inspector</th>
</tr>
</thead>
<tbody className="divide-y divide-gray-100">
              {filteredTests.length === 0 ? (
<tr>
<td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No geotechnical soil compaction tests recorded.
</td>
</tr>
) : (
                filteredTests.map((test) => (
<tr key={test.id} className="hover:bg-gray-50 transition">
<td className="px-4 py-3">
<div className="font-semibold text-gray-900">{test.testNumber}</div>
<div className="text-xs text-gray-500 font-mono mt-0.5">
                        {new Date(test.testDate).toLocaleDateString()}
</div>
<span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {test.testMethod.replace('_', ' ')}
</span>
</td>
<td className="px-4 py-3">
<div className="font-medium text-gray-800">{test.locationElement}</div>
<div className="text-xs text-amber-700 font-semibold mt-0.5">
                        {test.layerType.replace('_', ' ')}
</div>
</td>
<td className="px-4 py-3">
<div className="text-xs text-gray-700">MDD:<strong>{test.laboratoryMddGCm3}</strong> g/cm³</div>
<div className="text-xs text-gray-500">OMC:<strong>{test.laboratoryOmcPercent}%</strong></div>
</td>
<td className="px-4 py-3">
<div className="text-xs text-gray-700">Dry Density:<strong>{test.fieldDryDensityGCm3}</strong> g/cm³</div>
<div className="text-xs text-gray-500">Moisture:<strong>{test.fieldMoisturePercent}%</strong></div>
</td>
<td className="px-4 py-3">
<div className="text-base font-bold text-gray-900">{test.relativeCompactionPercent}%</div>
<div className="text-xs text-gray-400">Spec: ≥{test.requiredCompactionPercent}%</div>
</td>
<td className="px-4 py-3">
                      {test.estimatedCbrPercent ? (
<div>
<span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            CBR: {test.estimatedCbrPercent}%
</span>
<div className="text-xs text-gray-400 mt-0.5">{test.dcpBlowsPer100mm} blows/100mm</div>
</div>
) : (
<span className="text-xs text-gray-400">-</span>
)}
</td>
<td className="px-4 py-3">{getVerdictBadge(test.qaVerdict)}</td>
<td className="px-4 py-3 text-xs text-gray-600 font-medium">{test.inspectedBy}</td>
</tr>
))
)}
</tbody>
</table>
</div>
</div>

      {/* MODAL: Log Field Compaction Test */}
      {showAddModal && (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-soil-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
        >
<div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
<div className="flex justify-between items-center border-b pb-3">
<div>
<h3 id="modal-soil-title" className="text-lg font-bold text-gray-900">Record Field Soil Compaction Test</h3>
<p className="text-xs text-gray-500">BS 1377 In-Situ Density &amp; Dynamic Cone Penetrometer (DCP)</p>
</div>
<button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                
</button>
</div>

            {errorMessage && (
<div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                 {errorMessage}
</div>
)}

<form onSubmit={handleCreateTest} className="space-y-4 text-sm">
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="soil-test-number" className="block text-xs font-medium text-gray-700">Test Number *</label>
<input
                    id="soil-test-number"
                    type="text"
                    required
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
                  />
</div>
<div>
<label htmlFor="soil-test-method" className="block text-xs font-medium text-gray-700">Test Method</label>
<select
                    id="soil-test-method"
                    value={testMethod}
                    onChange={(e) => setTestMethod(e.target.value as any)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
<option value="SAND_REPLACEMENT">Sand Replacement (BS 1377:Part 9)</option>
<option value="NUCLEAR_GAUGE">Nuclear Density Gauge (ASTM D6938)</option>
<option value="CORE_CUTTER">Core Cutter Method (Cohesive Soils)</option>
</select>
</div>
</div>

<div>
<label htmlFor="soil-location-element" className="block text-xs font-medium text-gray-700">Chainage / Structural Location *</label>
<input
                  id="soil-location-element"
                  type="text"
                  required
                  placeholder="e.g. Subbase Ch 2+100 - 2+350 RHS"
                  value={locationElement}
                  onChange={(e) => setLocationElement(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="soil-layer-type" className="block text-xs font-medium text-gray-700">Layer Type *</label>
<select
                    id="soil-layer-type"
                    value={layerType}
                    onChange={(e) => setLayerType(e.target.value as any)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
<option value="SUBBASE">Subbase (Natural Gravel / GCI)</option>
<option value="BASE_COURSE">Base Course (Crushed Stone / DBM)</option>
<option value="SUBGRADE">Subgrade (Roadbed)</option>
<option value="FOUNDATION_PAD">Foundation Pad (Engineered Fill)</option>
<option value="EMBANKMENT_FILL">Embankment Fill</option>
</select>
</div>
<div>
<label htmlFor="soil-required-compaction" className="block text-xs font-medium text-gray-700">Required Compaction (%)</label>
<input
                    id="soil-required-compaction"
                    type="number"
                    step="0.5"
                    required
                    value={requiredCompaction}
                    onChange={(e) => setRequiredCompaction(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

              {/* Proctor Targets */}
<div className="bg-amber-50 border border-amber-200 p-3 rounded-lg grid grid-cols-2 gap-3 text-xs">
<div>
<label htmlFor="soil-lab-mdd" className="block font-medium text-amber-900">Lab MDD Target (g/cm³)</label>
<input
                    id="soil-lab-mdd"
                    type="number"
                    step="0.001"
                    required
                    value={labMdd}
                    onChange={(e) => setLabMdd(e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white"
                  />
</div>
<div>
<label htmlFor="soil-lab-omc" className="block font-medium text-amber-900">Lab OMC Target (%)</label>
<input
                    id="soil-lab-omc"
                    type="number"
                    step="0.1"
                    required
                    value={labOmc}
                    onChange={(e) => setLabOmc(e.target.value)}
                    className="mt-1 w-full border rounded px-2 py-1 text-sm bg-white"
                  />
</div>
</div>

              {/* Field Measurements */}
<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="soil-wet-density" className="block text-xs font-medium text-gray-700">Field Wet Density (g/cm³) *</label>
<input
                    id="soil-wet-density"
                    type="number"
                    step="0.001"
                    required
                    value={fieldWetDensity}
                    onChange={(e) => setFieldWetDensity(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
</div>
<div>
<label htmlFor="soil-moisture" className="block text-xs font-medium text-gray-700">Field Moisture Content (%) *</label>
<input
                    id="soil-moisture"
                    type="number"
                    step="0.1"
                    required
                    value={fieldMoisture}
                    onChange={(e) => setFieldMoisture(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold"
                  />
</div>
</div>

<div className="grid grid-cols-2 gap-3">
<div>
<label htmlFor="soil-dcp-blows" className="block text-xs font-medium text-gray-700">DCP Blows / 100mm (Optional)</label>
<input
                    id="soil-dcp-blows"
                    type="number"
                    value={dcpBlows || ''}
                    onChange={(e) => setDcpBlows(parseInt(e.target.value) || undefined)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
<div>
<label htmlFor="soil-inspector-name" className="block text-xs font-medium text-gray-700">Inspecting Engineer *</label>
<input
                    id="soil-inspector-name"
                    type="text"
                    required
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
</div>
</div>

              {/* Live Preview Box */}
<div className="bg-gray-100 border p-3 rounded-lg flex justify-between items-center text-xs">
<div>
<span className="text-gray-500">Field Dry Density:</span>
<div className="text-base font-bold text-gray-900">{formMetrics.dryDensity} g/cm³</div>
</div>
<div>
<span className="text-gray-500">Relative Compaction:</span>
<div className="text-base font-bold text-blue-700">{formMetrics.rc}%</div>
</div>
<div>
<span className="text-gray-500">QA Verdict:</span>
<div>{getVerdictBadge(formMetrics.verdict)}</div>
</div>
</div>

<div className="flex justify-end gap-2 pt-3 border-t">
<button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
</button>
<button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Soil Test Record'}
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};
