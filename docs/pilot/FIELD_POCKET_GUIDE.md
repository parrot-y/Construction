# MjengoLedger — Site Supervisor & Foreman Field Pocket Guide (Mwongozo wa Site)

**Target Role:** Site Supervisors, Foremen (*Capitao*), Field Engineers & Clerks of Works  
**Devices Supported:** Android (Chrome), iOS (Safari), KaiOS / Feature Browser  
**Languages:** English with local Kenyan construction terms (*Sheng / Swahili*)  
**Version:** 1.0 (Pilot Edition)

---

## 1. Fast PWA Setup on Your Phone (Dakika Mbili)

`MjengoLedger` is a Progressive Web App (PWA). It does **not** take up 100MB of phone memory from the Google Play Store, and it works even when Safaricom / Airtel network drops to 2G or offline.

```
+-------------------------------------------------------------------------+
| STEP 1: Open Chrome Browser on your smartphone.                         |
| STEP 2: Go to the site URL provided by your PM/QS.                      |
| STEP 3: Tap the 3 dots (⋮) in the top right corner of Chrome.            |
| STEP 4: Tap "Install App" or "Add to Home Screen".                      |
| STEP 5: An icon named "MjengoLedger" appears on your phone screen!      |
+-------------------------------------------------------------------------+
```

### Checking Offline Mode (*Bila Bundles au Network*):
1. Turn on **Airplane Mode** (Disconnect Wi-Fi and Mobile Data).
2. Open `MjengoLedger` from your home screen.
3. Notice the top banner: **"Offline Mode • Local Queue Active"**.
4. You can still post site diaries, count workers, log cement deliveries, and snap photos. Everything saves safely to your phone storage (`IndexedDB`) and automatically uploads as soon as network returns.

---

## 2. Daily 60-Second Morning & Evening Site Diary

Stop typing long WhatsApp messages that get buried or ignored. Use the **Daily Site Diary Modal** in under 60 seconds:

### A. Weather & Site Status
- **Weather:** Select `SUNNY_CLEAR` (*Jua Kali*), `RAIN_DELAY` (*Mvua Kidogo*), or `HEAVY_RAIN` (*Kazi Imesimama*).
- **Status:** Select `OPERATIONAL` (*Kazi Inaendelea*), `PARTIAL`, or `STOPPED`.

### B. Trades Headcount Matrix (*Mafundi na Vibarua*)
Do not just write "30 workers". Count by trade so the QS tracks labor costs against the BOQ:
- **Masons (*Mafundi wa Mawe*):** e.g. `4`
- **Carpenters (*Mafundi wa Mbao / Formwork*):** e.g. `2`
- **Steel Fixers (*Mafundi wa Chuma / Rebar*):** e.g. `3`
- **Casual Laborers (*Vibarua wa Kuchota Mchanga/Zege*):** e.g. `8`
- Total calculates automatically!

### C. Inward Material Delivery Verification
When a lorry or pickup drops off building materials:
1. Tap **Log Delivery**.
2. Enter Material: e.g. `Bamburi Portland Cement 32.5N` or `Machine-Cut Stone 9x9`.
3. Enter Quantity & Unit: e.g. `200 BAGS` or `1,500 PCS`.
4. Enter Supplier Name & Delivery Note number (e.g. `DN-BAM-90812`).
5. Snap a photo of the signed delivery docket and the unloaded material.

### D. Plant & Machinery Hire Log (*Mixer, Poker na Excavator*)
Protect the company from inflated machinery bills and fuel loss:
- **Equipment:** e.g. `Concrete Mixer 350L (Diesel)` or `JCB Excavator 3CX`.
- **Hours Operated:** e.g. `6.0 hrs` (record standing/breakdown time separately in notes).
- **Fuel Issued:** e.g. `15 Litres Diesel`.

### E. Photo Evidence & Auto Data Saver (*Save Bundles*)
- Tap **Take Photo** using your phone camera.
- The phone's HTML5 Canvas automatically compresses large 5MB photos down to **~150KB** without losing sharpness.
- GPS coordinates (Nairobi / Kiambu) and timestamp are attached automatically.
- Your personal Safaricom data bundles are protected!

---

## 3. Engineering Quality Control & Concrete Cubes (KS 02-598)

Under Kenyan building regulations (**NCA Cap 499A** and **BORAQS Cap 525**), the contractor must prove that concrete meets structural design grade.

### A. Pre-Pour Inspection Checklist (Hold Points)
**DO NOT POUR CONCRETE** until the Pre-Pour Checklist is verified:
1. Rebar spacing, overlap, and tie wire tightness verified against structural drawings.
2. Concrete cover blocks (e.g. 40mm for foundation footings, 25mm for slabs/beams) placed and tied.
3. Formwork (*mbao*) clean of loose soil, sawdust, and oil.
4. If Architect / Resident Engineer is on site, ask them to inspect and sign off.

### B. Concrete Cube Crushing Protocol
For every major pour (footings, columns, suspended slab):
1. Cast a batch of **6 concrete test cubes** ($150 \times 150 \times 150\text{ mm}$).
2. Log Batch Reference in MjengoLedger: e.g. `BT-001`.
3. Record Slump Test: e.g. `100 mm`.
4. Write date and batch code with permanent marker on the cubes after demoulding (24 hrs).
5. Submerge cubes in water curing tank on site.
6. **7-Day Break:** Test 3 cubes at accredited laboratory. Target $\ge 65\%$ of design grade (e.g. $\ge 16.25\text{ MPa}$ for Class 25/20).
7. **28-Day Break:** Test remaining 3 cubes. Target $\ge 100\%$ (e.g. $\ge 25.00\text{ MPa}$).

---

## 4. Snagging & Subcontractor Defects Handover

When approaching Practical Completion or during trade finishes (tiling, plumbing, electrical, painting):
1. Walk the floor room by room.
2. Tap **Create Snag Item**:
   - Location: e.g. `Floor 2, Washroom 2A`.
   - Trade: e.g. `Plumbing` (*Simba Plumbing Ltd*).
   - Severity: `AESTHETIC` (*Rangi mbaya*), `FUNCTIONAL` (*Bomba inavuja*), or `SAFETY`.
   - Snap a photo of the defect.
3. Generate a **Subcontractor Portal Link**:
   - Copy the link and WhatsApp it directly to the subcontractor fundi.
   - The subcontractor opens the link (no password needed), views the defect, fixes the work, and uploads a "Rectified" photo proof.
4. Inspect the repair on site and tap **Verify & Close Defect**.

---

## 5. Summary Cheat Sheet for Site Foremen

| Time | Action | Screen in MjengoLedger | Duration |
|---|---|---|---|
| **07:30 AM** | Record morning weather, site status, and worker headcount | **Site Diary Modal** | 45 seconds |
| **During Day** | Log material trucks arriving on site + snap photo of docket | **Site Diary -> Delivery** | 30 seconds |
| **Before Pour** | Verify rebar, cover blocks, and formwork cleanliness | **Quality Control -> Checklists** | 2 minutes |
| **During Pour** | Cast 6 test cubes, record slump and supplier batch | **Quality Control -> Cubes** | 2 minutes |
| **05:00 PM** | Log equipment hours, fuel issued, and take 2 GPS photos | **Site Diary -> Equipment & Photos** | 60 seconds |
| **Friday PM** | Walk site with PM and record physical progress % | **Record Physical Progress** | 3 minutes |

**Support Contact:**  
Call or WhatsApp your Project Manager / QS or email `support@mjengoledger.co.ke` if your device needs assistance.
