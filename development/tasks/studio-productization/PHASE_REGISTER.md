# Studio Productization Phase Register

## Sequence

| Phase | Outcome | Dependency | Exit proof |
|---|---|---|---|
| ES-1 | Real project lifecycle and active-project shell | Memory project APIs and EM-1 isolation contract | Create two projects, switch between them, reload, and observe no cross-project transcript or projection data |
| ES-2 | Truthful selected-project projections across all routes | ES-1; coherent Memory consumer projections (EM-4) | Every route identifies the same project/revision and contains no entity from another project |
| ES-3 | Usable conversation workspace | ES-1; CIE cooperative-turn work for behavior changes | Long histories remain navigable; one current move is prominent; transport/system repetition is not presented as multiple user actions |
| ES-4 | Actionable empty and blocked page states | ES-2 | Definition, Modules, Interfaces, Architecture, Dependencies, Plan, and Deliverables each explain current state and offer one valid next action |
| ES-5 | Scalable Requirements and Reviews experience | Memory canonicalization/deduplication (EM-3) for canonical records | Counts reconcile; provenance classifications are honest; search/filter/bulk review work on canonical items |
| ES-6 | Honest planning, generation, and publication affordances | ES-2; real deliverable/readiness contracts | No package, plan, module, or dependency is claimed unless present in the selected project projection |
| ES-7 | Diagnostics, settings, and deployment-status truthfulness | ES-1 through ES-6 | Settings works or is removed; status distinguishes connectivity, synchronization, revision, and project health |
| ES-8 | Deployed end-to-end product validation | All previous phases | A clean project passes the create→discover→review→leave→reopen browser scenario |

## Gates

### Gate A — project isolation

ES-2 onward may use mock data in tests, but the running application must obtain project identity from a real project contract. A build-time or hard-coded project ID is not an acceptable product lifecycle.

### Gate B — one source of truth

All routes consume the selected project's Memory-owned state. Studio must not retain a second durable project model to make pages appear complete.

### Gate C — capability honesty

An unavailable contract produces an explicit unavailable/blocked state. It does not produce fixture-derived architecture, plans, deliverables, acceptance criteria, or explanations.

### Gate D — backend ownership

When a target depends on EM or EC phases in KAE-Ecosystem, record the dependency and stop at the Studio boundary. Do not implement semantic knowledge repair or interviewing policy in this repository.
