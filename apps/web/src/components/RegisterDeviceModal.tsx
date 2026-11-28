import React from 'react';

export const RegisterDeviceModal: React.FC<{
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newEquipName: string;
  setNewEquipName: React.Dispatch<React.SetStateAction<string>>;
  newEquipCode: string;
  setNewEquipCode: React.Dispatch<React.SetStateAction<string>>;
  newProtocol: 'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW';
  setNewProtocol: React.Dispatch<React.SetStateAction<'OBD2' | 'CANBUS' | 'GPS_MODEM' | 'MODBUS_FLOW'>>;
  newBaudRate: number;
  setNewBaudRate: React.Dispatch<React.SetStateAction<number>>;
  newMaxBurnRate: string;
  setNewMaxBurnRate: React.Dispatch<React.SetStateAction<string>>;
  newImei: string;
  setNewImei: React.Dispatch<React.SetStateAction<string>>;
  newTankCap: string;
  setNewTankCap: React.Dispatch<React.SetStateAction<string>>;
  newTankGeometry: 'RECTANGULAR' | 'CYLINDRICAL_HORIZONTAL' | 'CUSTOM_CURVE';
  setNewTankGeometry: React.Dispatch<React.SetStateAction<'RECTANGULAR' | 'CYLINDRICAL_HORIZONTAL' | 'CUSTOM_CURVE'>>;
  newSimPhone: string;
  setNewSimPhone: React.Dispatch<React.SetStateAction<string>>;
}> = ({
  onClose,
  onSubmit,
  newEquipName,
  setNewEquipName,
  newEquipCode,
  setNewEquipCode,
  newProtocol,
  setNewProtocol,
  newBaudRate,
  setNewBaudRate,
  newMaxBurnRate,
  setNewMaxBurnRate,
  newImei,
  setNewImei,
  newTankCap,
  setNewTankCap,
  newTankGeometry,
  setNewTankGeometry,
  newSimPhone,
  setNewSimPhone,
}) => (
<div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-device-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
<div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
<div className="flex justify-between items-center border-b border-slate-100 pb-3">
<h3 id="reg-device-modal-title" className="font-bold text-slate-800 text-base">
                Register Telematics Hardware
</h3>
<button
                onClick={onClose}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-base"
              >
                
</button>
</div>

<form onSubmit={onSubmit} className="space-y-3 text-xs">
<div>
<label htmlFor="reg-equip-name" className="block font-semibold text-slate-700 mb-1">
                  Equipment Name
</label>
<input
                  id="reg-equip-name"
                  type="text"
                  value={newEquipName}
                  onChange={(e) => setNewEquipName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  required
                />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-equip-code" className="block font-semibold text-slate-700 mb-1">
                    Equipment Code
</label>
<input
                    id="reg-equip-code"
                    type="text"
                    value={newEquipCode}
                    onChange={(e) => setNewEquipCode(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                    required
                  />
</div>
<div>
<label htmlFor="reg-protocol" className="block font-semibold text-slate-700 mb-1">
                    Protocol
</label>
<select
                    id="reg-protocol"
                    value={newProtocol}
                    onChange={(e) => setNewProtocol(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  >
<option value="CANBUS">CANBUS (Heavy Plant J1939)</option>
<option value="OBD2">OBD2 (Fleet Trucks)</option>
<option value="GPS_MODEM">GPS MODEM (Standalone)</option>
<option value="MODBUS_FLOW">MODBUS FLOW (Fuel meter)</option>
</select>
</div>
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-baud-rate" className="block font-semibold text-slate-700 mb-1">
                    CAN Baud Rate
</label>
<select
                    id="reg-baud-rate"
                    value={newBaudRate}
                    onChange={(e) => setNewBaudRate(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800 tabular-nums"
                  >
<option value={250000}>250 kbps (J1939 Standard)</option>
<option value={500000}>500 kbps (High Speed CAN)</option>
</select>
</div>
<div>
<label htmlFor="reg-max-burn" className="block font-semibold text-slate-700 mb-1">
                    Max Burn Rate (L/h)
</label>
<input
                    id="reg-max-burn"
                    type="text"
                    value={newMaxBurnRate}
                    onChange={(e) => setNewMaxBurnRate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                    required
                  />
</div>
</div>

<div>
<label htmlFor="reg-imei" className="block font-semibold text-slate-700 mb-1">
                  Hardware Device IMEI
</label>
<input
                  id="reg-imei"
                  type="text"
                  value={newImei}
                  onChange={(e) => setNewImei(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                  required
                />
</div>

<div className="grid grid-cols-2 gap-2">
<div>
<label htmlFor="reg-tank-cap" className="block font-semibold text-slate-700 mb-1">
                    Tank Capacity (Liters)
</label>
<input
                    id="reg-tank-cap"
                    type="text"
                    value={newTankCap}
                    onChange={(e) => setNewTankCap(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                    required
                  />
</div>
<div>
<label htmlFor="reg-tank-geom" className="block font-semibold text-slate-700 mb-1">
                    Tank Geometry
</label>
<select
                    id="reg-tank-geom"
                    value={newTankGeometry}
                    onChange={(e) => setNewTankGeometry(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-slate-800"
                  >
<option value="RECTANGULAR">Rectangular Prism</option>
<option value="CYLINDRICAL_HORIZONTAL">Horizontal Cylinder</option>
<option value="CUSTOM_CURVE">Custom Strapping Table</option>
</select>
</div>
</div>

<div>
<label htmlFor="reg-sim-phone" className="block font-semibold text-slate-700 mb-1">
                  SIM Card Phone Number
</label>
<input
                  id="reg-sim-phone"
                  type="text"
                  value={newSimPhone}
                  onChange={(e) => setNewSimPhone(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 tabular-nums text-slate-800"
                />
</div>

<div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
<button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-sm"
                >
                  Register Device
</button>
</div>
</form>
</div>
</div>
);
