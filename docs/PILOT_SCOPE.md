# SiteSafi Pilot Scope (B1)

Per-tenant module flags live in `tenant_module_flags` (RLS tenant-scoped).
Non-core modules are **OFF by default**; the platform operator enables them
per tenant via `PUT /api/v1/operator/tenants/:id/modules` (OPERATOR_KEY).
Gated API routes return **404** when the flag is off — not just hidden UI.
Tenants read their enabled set via `GET /api/v1/company/modules`; the console
hides gated modules from dashboards/navigation once flags load.

`DISABLED_MODULES` env remains a global kill switch on top of tenant flags.

## Pilot Core (always enabled)

quotes · projects · BoQ · budget & costs · site diary · progress ·
variations · payment certificates · invoices & payments · retention ·
subcontractors & valuations · procurement/POs · RFIs · snags · inspections ·
safety incidents · documents/drawings · notifications · members & roles ·
five external portals · announcements · company export · attendance

## Gated modules (default OFF for pilot tenants)

| Flag id    | Route families gated                                             | UI surfaces                                  |
|------------|------------------------------------------------------------------|----------------------------------------------|
| equipment  | /equipment, /equipment-logs, /maintenance-alerts                | PlantEquipment, equipment cards              |
| telematics | /telematics-*, /canbus-devices, /api/v1/telematics/*            | PlantTelematics                              |
| soil       | /soil-tests                                                      | GeotechnicalSoilView                         |
| survey     | /topographic-surveys                                            | TopographicSurveyView                        |
| tenders    | /tenders                                                         | ContractorTenderBoard                        |
| steel      | /structural-steel-takeoffs                                       | steel takeoff views                          |
| asphalt    | /asphalt-batches                                                 | AsphaltPavementView                          |
| geofence   | /geofences, /clock-events, /clock-in                            | GeofencedClockInView                         |
| rmc        | /rmc-deliveries                                                  | RmcTransitTracker                            |
| muster     | /muster-rolls, /laborers                                         | LaborMusterRollView                          |
| independent| /independent-inspections, /reports/independent-inspections/*    | IndependentSiteReportView                    |
| rebar      | /bar-bending-schedules                                           | BarBendingScheduleView                       |
| safety-audits | /safety-audits, /site-alerts                                 | SafetyAuditScorecardView                     |
| correspondence | /correspondence                                             | CorrespondenceView                           |
| inventory  | /inventory, /material-requisitions, /material-wastage           | inventory/material tabs                      |

Note: `/safety-incidents` and `/attendance/*` are Pilot Core (never gated);
only the formal safety-audit scorecards and site alerts are peripheral.
The geofenced `/clock-in` + `/clock-events` ingest stays under `geofence`
(field check-in uses the core `/attendance/*` routes).

Note: `correspondence` and `inventory` are gated conservatively (not in the
Pilot Core list); the operator can re-enable per tenant without a deploy.
The demo/dev seed tenant has all flags enabled so the full suite stays
exercisable.
