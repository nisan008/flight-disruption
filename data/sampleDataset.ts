/**
 * Domino Sky — Sample Dataset
 *
 * A realistic Indian domestic aviation dataset with 16 airports, 16 aircraft,
 * 70 flights, 28 passenger connections, 14 crew assignments, and 4 spare aircraft.
 *
 * All times are in minutes from midnight (0 = 00:00, 1439 = 23:59).
 *
 * DEMO SCENARIO: A BOM (Mumbai) closure from 14:00–15:30 (840–930) cascades
 * through at least 3 aircraft rotations and breaks several connections.
 *
 * Aircraft rotations are designed so flights through BOM in the 13:00–16:00
 * window create a realistic domino effect of delays.
 */

import { Dataset } from '../engine/types';

export const SAMPLE_DATASET: Dataset = {
  // =========================================================================
  // AIRPORTS — 16 Indian airports with real coordinates
  // =========================================================================
  airports: [
    { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
    { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', lat: 28.5562, lng: 77.1000 },
    { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', lat: 13.1986, lng: 77.7066 },
    { code: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', lat: 22.6520, lng: 88.4463 },
    { code: 'MAA', name: 'Chennai International Airport', city: 'Chennai', lat: 12.9941, lng: 80.1709 },
    { code: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', lat: 17.2403, lng: 78.4294 },
    { code: 'COK', name: 'Cochin International Airport', city: 'Kochi', lat: 10.1520, lng: 76.3920 },
    { code: 'GOI', name: 'Goa International Airport', city: 'Goa', lat: 15.3808, lng: 73.8314 },
    { code: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
    { code: 'PNQ', name: 'Pune Airport', city: 'Pune', lat: 18.5822, lng: 73.9197 },
    { code: 'JAI', name: 'Jaipur International Airport', city: 'Jaipur', lat: 26.8242, lng: 75.8122 },
    { code: 'LKO', name: 'Chaudhary Charan Singh International Airport', city: 'Lucknow', lat: 26.7606, lng: 80.8893 },
    { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi International Airport', city: 'Guwahati', lat: 26.1061, lng: 91.5859 },
    { code: 'IXC', name: 'Chandigarh International Airport', city: 'Chandigarh', lat: 30.6735, lng: 76.7885 },
    { code: 'PAT', name: 'Jay Prakash Narayan International Airport', city: 'Patna', lat: 25.5913, lng: 85.0880 },
    { code: 'BBI', name: 'Biju Patnaik International Airport', city: 'Bhubaneswar', lat: 20.2444, lng: 85.8178 },
  ],

  // =========================================================================
  // FLIGHTS — 70 flights across 16 aircraft
  // =========================================================================
  //
  // 6 aircraft have 5 flights each (30) + 10 aircraft have 4 flights each (40) = 70
  //
  // KEY: Flights marked ★BOM★ transit through Mumbai during the 13:00–16:00
  //      window and will be directly affected by the demo closure.
  //
  // =========================================================================
  flights: [
    // -----------------------------------------------------------------------
    // VT-AAA: BOM hub — 5 legs   BOM→DEL→BOM→BLR→BOM→HYD
    // ★BOM★ Legs 3 & 4 hit the closure window
    // -----------------------------------------------------------------------
    // Leg 1: BOM→DEL  06:00–08:30
    { id: 'DS-101', aircraftId: 'VT-AAA', origin: 'BOM', destination: 'DEL', scheduledDeparture: 360, scheduledArrival: 510, passengerCount: 174, sequenceInRotation: 0, crewId: 'CREW-01' },
    // Leg 2: DEL→BOM  09:00–11:30
    { id: 'DS-102', aircraftId: 'VT-AAA', origin: 'DEL', destination: 'BOM', scheduledDeparture: 540, scheduledArrival: 690, passengerCount: 168, sequenceInRotation: 1, crewId: 'CREW-01' },
    // Leg 3: BOM→BLR  12:00–13:30  ★ arrives BLR fine, but aircraft returns to BOM
    { id: 'DS-103', aircraftId: 'VT-AAA', origin: 'BOM', destination: 'BLR', scheduledDeparture: 720, scheduledArrival: 810, passengerCount: 162, sequenceInRotation: 2, crewId: 'CREW-01' },
    // Leg 4: BLR→BOM  14:00–15:30  ★BOM★ ARRIVES AT BOM during closure (arr 15:30 = 930)
    { id: 'DS-104', aircraftId: 'VT-AAA', origin: 'BLR', destination: 'BOM', scheduledDeparture: 840, scheduledArrival: 930, passengerCount: 170, sequenceInRotation: 3, crewId: 'CREW-01' },
    // Leg 5: BOM→HYD  16:00–17:45  ★ delayed by closure cascade
    { id: 'DS-105', aircraftId: 'VT-AAA', origin: 'BOM', destination: 'HYD', scheduledDeparture: 960, scheduledArrival: 1065, passengerCount: 155, sequenceInRotation: 4, crewId: 'CREW-01' },

    // -----------------------------------------------------------------------
    // VT-AAB: DEL hub — 5 legs   DEL→BOM→GOI→BOM→DEL→JAI
    // ★BOM★ Legs 2→3 transit BOM in the closure window
    // -----------------------------------------------------------------------
    // Leg 1: DEL→BOM  06:30–09:00
    { id: 'DS-106', aircraftId: 'VT-AAB', origin: 'DEL', destination: 'BOM', scheduledDeparture: 390, scheduledArrival: 540, passengerCount: 170, sequenceInRotation: 0, crewId: 'CREW-02' },
    // Leg 2: BOM→GOI  09:30–10:30
    { id: 'DS-107', aircraftId: 'VT-AAB', origin: 'BOM', destination: 'GOI', scheduledDeparture: 570, scheduledArrival: 630, passengerCount: 158, sequenceInRotation: 1, crewId: 'CREW-02' },
    // Leg 3: GOI→BOM  11:00–12:00
    { id: 'DS-108', aircraftId: 'VT-AAB', origin: 'GOI', destination: 'BOM', scheduledDeparture: 660, scheduledArrival: 720, passengerCount: 152, sequenceInRotation: 2, crewId: 'CREW-02' },
    // Leg 4: BOM→DEL  13:30–16:00  ★BOM★ Departs BOM at 13:30, fine. But if delayed: departure inside closure
    { id: 'DS-109', aircraftId: 'VT-AAB', origin: 'BOM', destination: 'DEL', scheduledDeparture: 810, scheduledArrival: 960, passengerCount: 176, sequenceInRotation: 3, crewId: 'CREW-02' },
    // Leg 5: DEL→JAI  16:30–17:45
    { id: 'DS-110', aircraftId: 'VT-AAB', origin: 'DEL', destination: 'JAI', scheduledDeparture: 990, scheduledArrival: 1065, passengerCount: 150, sequenceInRotation: 4, crewId: 'CREW-02' },

    // -----------------------------------------------------------------------
    // VT-AAC: BOM hub — 5 legs   BOM→MAA→BOM→PNQ→BOM→COK
    // ★BOM★ Leg 3 arrives BOM at 14:35, Leg 4 departs BOM at 15:15
    // -----------------------------------------------------------------------
    // Leg 1: BOM→MAA  07:00–09:00
    { id: 'DS-111', aircraftId: 'VT-AAC', origin: 'BOM', destination: 'MAA', scheduledDeparture: 420, scheduledArrival: 540, passengerCount: 165, sequenceInRotation: 0, crewId: 'CREW-03' },
    // Leg 2: MAA→BOM  09:30–11:30
    { id: 'DS-112', aircraftId: 'VT-AAC', origin: 'MAA', destination: 'BOM', scheduledDeparture: 570, scheduledArrival: 690, passengerCount: 172, sequenceInRotation: 1, crewId: 'CREW-03' },
    // Leg 3: BOM→PNQ  12:30–13:30
    { id: 'DS-113', aircraftId: 'VT-AAC', origin: 'BOM', destination: 'PNQ', scheduledDeparture: 750, scheduledArrival: 810, passengerCount: 154, sequenceInRotation: 2, crewId: 'CREW-03' },
    // Leg 4: PNQ→BOM  14:00–14:55  ★BOM★ Arrives BOM at 14:55 — DURING closure
    { id: 'DS-114', aircraftId: 'VT-AAC', origin: 'PNQ', destination: 'BOM', scheduledDeparture: 840, scheduledArrival: 895, passengerCount: 160, sequenceInRotation: 3, crewId: 'CREW-03' },
    // Leg 5: BOM→COK  15:30–17:30  ★ Departs BOM at 15:30 — blocked by closure
    { id: 'DS-115', aircraftId: 'VT-AAC', origin: 'BOM', destination: 'COK', scheduledDeparture: 930, scheduledArrival: 1050, passengerCount: 163, sequenceInRotation: 4, crewId: 'CREW-03' },

    // -----------------------------------------------------------------------
    // VT-AAD: DEL hub — 5 legs   DEL→CCU→DEL→LKO→DEL→GAU
    // Not directly affected by BOM closure but downstream connections break
    // -----------------------------------------------------------------------
    // Leg 1: DEL→CCU  06:00–08:30
    { id: 'DS-116', aircraftId: 'VT-AAD', origin: 'DEL', destination: 'CCU', scheduledDeparture: 360, scheduledArrival: 510, passengerCount: 171, sequenceInRotation: 0, crewId: 'CREW-04' },
    // Leg 2: CCU→DEL  09:15–11:30
    { id: 'DS-117', aircraftId: 'VT-AAD', origin: 'CCU', destination: 'DEL', scheduledDeparture: 555, scheduledArrival: 690, passengerCount: 164, sequenceInRotation: 1, crewId: 'CREW-04' },
    // Leg 3: DEL→LKO  12:15–13:30
    { id: 'DS-118', aircraftId: 'VT-AAD', origin: 'DEL', destination: 'LKO', scheduledDeparture: 735, scheduledArrival: 810, passengerCount: 155, sequenceInRotation: 2, crewId: 'CREW-04' },
    // Leg 4: LKO→DEL  14:15–15:30
    { id: 'DS-119', aircraftId: 'VT-AAD', origin: 'LKO', destination: 'DEL', scheduledDeparture: 855, scheduledArrival: 930, passengerCount: 158, sequenceInRotation: 3, crewId: 'CREW-04' },
    // Leg 5: DEL→GAU  16:15–19:00
    { id: 'DS-120', aircraftId: 'VT-AAD', origin: 'DEL', destination: 'GAU', scheduledDeparture: 975, scheduledArrival: 1140, passengerCount: 160, sequenceInRotation: 4, crewId: 'CREW-04' },

    // -----------------------------------------------------------------------
    // VT-AAE: BLR hub — 5 legs   BLR→HYD→BLR→MAA→BLR→COK
    // -----------------------------------------------------------------------
    // Leg 1: BLR→HYD  06:30–07:30
    { id: 'DS-121', aircraftId: 'VT-AAE', origin: 'BLR', destination: 'HYD', scheduledDeparture: 390, scheduledArrival: 450, passengerCount: 162, sequenceInRotation: 0, crewId: 'CREW-05' },
    // Leg 2: HYD→BLR  08:00–09:00
    { id: 'DS-122', aircraftId: 'VT-AAE', origin: 'HYD', destination: 'BLR', scheduledDeparture: 480, scheduledArrival: 540, passengerCount: 158, sequenceInRotation: 1, crewId: 'CREW-05' },
    // Leg 3: BLR→MAA  09:30–10:30
    { id: 'DS-123', aircraftId: 'VT-AAE', origin: 'BLR', destination: 'MAA', scheduledDeparture: 570, scheduledArrival: 630, passengerCount: 155, sequenceInRotation: 2, crewId: 'CREW-05' },
    // Leg 4: MAA→BLR  11:00–12:00
    { id: 'DS-124', aircraftId: 'VT-AAE', origin: 'MAA', destination: 'BLR', scheduledDeparture: 660, scheduledArrival: 720, passengerCount: 169, sequenceInRotation: 3, crewId: 'CREW-05' },
    // Leg 5: BLR→COK  12:30–13:30
    { id: 'DS-125', aircraftId: 'VT-AAE', origin: 'BLR', destination: 'COK', scheduledDeparture: 750, scheduledArrival: 810, passengerCount: 153, sequenceInRotation: 4, crewId: 'CREW-05' },

    // -----------------------------------------------------------------------
    // VT-AAF: CCU hub — 5 legs   CCU→BBI→CCU→PAT→CCU→DEL
    // -----------------------------------------------------------------------
    // Leg 1: CCU→BBI  07:00–08:00
    { id: 'DS-126', aircraftId: 'VT-AAF', origin: 'CCU', destination: 'BBI', scheduledDeparture: 420, scheduledArrival: 480, passengerCount: 156, sequenceInRotation: 0, crewId: 'CREW-06' },
    // Leg 2: BBI→CCU  08:30–09:30
    { id: 'DS-127', aircraftId: 'VT-AAF', origin: 'BBI', destination: 'CCU', scheduledDeparture: 510, scheduledArrival: 570, passengerCount: 150, sequenceInRotation: 1, crewId: 'CREW-06' },
    // Leg 3: CCU→PAT  10:00–11:00
    { id: 'DS-128', aircraftId: 'VT-AAF', origin: 'CCU', destination: 'PAT', scheduledDeparture: 600, scheduledArrival: 660, passengerCount: 152, sequenceInRotation: 2, crewId: 'CREW-06' },
    // Leg 4: PAT→CCU  11:30–12:30
    { id: 'DS-129', aircraftId: 'VT-AAF', origin: 'PAT', destination: 'CCU', scheduledDeparture: 690, scheduledArrival: 750, passengerCount: 155, sequenceInRotation: 3, crewId: 'CREW-06' },
    // Leg 5: CCU→DEL  13:15–15:45
    { id: 'DS-130', aircraftId: 'VT-AAF', origin: 'CCU', destination: 'DEL', scheduledDeparture: 795, scheduledArrival: 945, passengerCount: 170, sequenceInRotation: 4, crewId: 'CREW-06' },

    // -----------------------------------------------------------------------
    // VT-AAG: BOM hub — 4 legs   BOM→AMD→BOM→DEL→BOM
    // ★BOM★ Leg 3 arrives BOM at 15:00 during closure, Leg 4 cascades
    // -----------------------------------------------------------------------
    // Leg 1: BOM→AMD  06:30–07:45
    { id: 'DS-131', aircraftId: 'VT-AAG', origin: 'BOM', destination: 'AMD', scheduledDeparture: 390, scheduledArrival: 465, passengerCount: 160, sequenceInRotation: 0, crewId: 'CREW-07' },
    // Leg 2: AMD→BOM  08:15–09:30
    { id: 'DS-132', aircraftId: 'VT-AAG', origin: 'AMD', destination: 'BOM', scheduledDeparture: 495, scheduledArrival: 570, passengerCount: 157, sequenceInRotation: 1, crewId: 'CREW-07' },
    // Leg 3: BOM→DEL  10:15–12:45
    { id: 'DS-133', aircraftId: 'VT-AAG', origin: 'BOM', destination: 'DEL', scheduledDeparture: 615, scheduledArrival: 765, passengerCount: 178, sequenceInRotation: 2, crewId: 'CREW-07' },
    // Leg 4: DEL→BOM  13:30–16:00  ★BOM★ Arrives BOM at 16:00 — just after closure but tight
    { id: 'DS-134', aircraftId: 'VT-AAG', origin: 'DEL', destination: 'BOM', scheduledDeparture: 810, scheduledArrival: 960, passengerCount: 175, sequenceInRotation: 3, crewId: 'CREW-07' },

    // -----------------------------------------------------------------------
    // VT-AAH: HYD hub — 4 legs   HYD→BOM→HYD→MAA→HYD
    // ★BOM★ Leg 1 arrives BOM at 09:30, Leg 2 departs BOM at 13:00
    //        — if BOM closes at 14:00 the departure is fine, BUT
    //        any earlier delay pushes into closure
    // -----------------------------------------------------------------------
    // Leg 1: HYD→BOM  08:00–09:45
    { id: 'DS-135', aircraftId: 'VT-AAH', origin: 'HYD', destination: 'BOM', scheduledDeparture: 480, scheduledArrival: 585, passengerCount: 164, sequenceInRotation: 0, crewId: 'CREW-08' },
    // Leg 2: BOM→HYD  13:00–14:45  ★BOM★ Departs BOM at 13:00 — just before closure
    { id: 'DS-136', aircraftId: 'VT-AAH', origin: 'BOM', destination: 'HYD', scheduledDeparture: 780, scheduledArrival: 885, passengerCount: 167, sequenceInRotation: 1, crewId: 'CREW-08' },
    // Leg 3: HYD→MAA  15:30–17:00
    { id: 'DS-137', aircraftId: 'VT-AAH', origin: 'HYD', destination: 'MAA', scheduledDeparture: 930, scheduledArrival: 1020, passengerCount: 159, sequenceInRotation: 2, crewId: 'CREW-08' },
    // Leg 4: MAA→HYD  17:30–18:45
    { id: 'DS-138', aircraftId: 'VT-AAH', origin: 'MAA', destination: 'HYD', scheduledDeparture: 1050, scheduledArrival: 1125, passengerCount: 155, sequenceInRotation: 3, crewId: 'CREW-08' },

    // -----------------------------------------------------------------------
    // VT-AAI: MAA hub — 4 legs   MAA→BLR→MAA→BOM→MAA
    // ★BOM★ Leg 3 flies MAA→BOM arriving 14:30 — DURING closure
    // -----------------------------------------------------------------------
    // Leg 1: MAA→BLR  07:30–08:30
    { id: 'DS-139', aircraftId: 'VT-AAI', origin: 'MAA', destination: 'BLR', scheduledDeparture: 450, scheduledArrival: 510, passengerCount: 161, sequenceInRotation: 0, crewId: 'CREW-09' },
    // Leg 2: BLR→MAA  09:00–10:00
    { id: 'DS-140', aircraftId: 'VT-AAI', origin: 'BLR', destination: 'MAA', scheduledDeparture: 540, scheduledArrival: 600, passengerCount: 158, sequenceInRotation: 1, crewId: 'CREW-09' },
    // Leg 3: MAA→BOM  12:30–14:30  ★BOM★ Arrives BOM at 14:30 — DURING closure (870)
    { id: 'DS-141', aircraftId: 'VT-AAI', origin: 'MAA', destination: 'BOM', scheduledDeparture: 750, scheduledArrival: 870, passengerCount: 173, sequenceInRotation: 2, crewId: 'CREW-09' },
    // Leg 4: BOM→MAA  15:15–17:15  ★ Departs BOM at 15:15 — DURING closure (915)
    { id: 'DS-142', aircraftId: 'VT-AAI', origin: 'BOM', destination: 'MAA', scheduledDeparture: 915, scheduledArrival: 1035, passengerCount: 166, sequenceInRotation: 3, crewId: 'CREW-09' },

    // -----------------------------------------------------------------------
    // VT-AAJ: DEL hub — 4 legs   DEL→IXC→DEL→BOM→PNQ
    // ★BOM★ Leg 3 flies DEL→BOM arriving 15:15 — DURING closure
    // -----------------------------------------------------------------------
    // Leg 1: DEL→IXC  07:00–08:00
    { id: 'DS-143', aircraftId: 'VT-AAJ', origin: 'DEL', destination: 'IXC', scheduledDeparture: 420, scheduledArrival: 480, passengerCount: 155, sequenceInRotation: 0, crewId: 'CREW-10' },
    // Leg 2: IXC→DEL  08:30–09:30
    { id: 'DS-144', aircraftId: 'VT-AAJ', origin: 'IXC', destination: 'DEL', scheduledDeparture: 510, scheduledArrival: 570, passengerCount: 152, sequenceInRotation: 1, crewId: 'CREW-10' },
    // Leg 3: DEL→BOM  12:30–15:00  ★BOM★ Arrives BOM at 15:00 — DURING closure (900)
    { id: 'DS-145', aircraftId: 'VT-AAJ', origin: 'DEL', destination: 'BOM', scheduledDeparture: 750, scheduledArrival: 900, passengerCount: 177, sequenceInRotation: 2, crewId: 'CREW-10' },
    // Leg 4: BOM→PNQ  15:45–16:45  ★ Departs BOM at 15:45 — delayed by closure
    { id: 'DS-146', aircraftId: 'VT-AAJ', origin: 'BOM', destination: 'PNQ', scheduledDeparture: 945, scheduledArrival: 1005, passengerCount: 150, sequenceInRotation: 3, crewId: 'CREW-10' },

    // -----------------------------------------------------------------------
    // VT-AAK: BLR hub — 4 legs   BLR→GOI→BLR→DEL→BLR
    // -----------------------------------------------------------------------
    // Leg 1: BLR→GOI  08:00–09:00
    { id: 'DS-147', aircraftId: 'VT-AAK', origin: 'BLR', destination: 'GOI', scheduledDeparture: 480, scheduledArrival: 540, passengerCount: 156, sequenceInRotation: 0, crewId: 'CREW-11' },
    // Leg 2: GOI→BLR  09:30–10:30
    { id: 'DS-148', aircraftId: 'VT-AAK', origin: 'GOI', destination: 'BLR', scheduledDeparture: 570, scheduledArrival: 630, passengerCount: 153, sequenceInRotation: 1, crewId: 'CREW-11' },
    // Leg 3: BLR→DEL  11:00–13:30
    { id: 'DS-149', aircraftId: 'VT-AAK', origin: 'BLR', destination: 'DEL', scheduledDeparture: 660, scheduledArrival: 810, passengerCount: 170, sequenceInRotation: 2, crewId: 'CREW-11' },
    // Leg 4: DEL→BLR  14:15–16:45
    { id: 'DS-150', aircraftId: 'VT-AAK', origin: 'DEL', destination: 'BLR', scheduledDeparture: 855, scheduledArrival: 1005, passengerCount: 168, sequenceInRotation: 3, crewId: 'CREW-11' },

    // -----------------------------------------------------------------------
    // VT-AAL: DEL hub — 4 legs   DEL→JAI→DEL→MAA→DEL
    // -----------------------------------------------------------------------
    // Leg 1: DEL→JAI  06:00–07:15
    { id: 'DS-151', aircraftId: 'VT-AAL', origin: 'DEL', destination: 'JAI', scheduledDeparture: 360, scheduledArrival: 435, passengerCount: 155, sequenceInRotation: 0, crewId: 'CREW-12' },
    // Leg 2: JAI→DEL  07:45–09:00
    { id: 'DS-152', aircraftId: 'VT-AAL', origin: 'JAI', destination: 'DEL', scheduledDeparture: 465, scheduledArrival: 540, passengerCount: 158, sequenceInRotation: 1, crewId: 'CREW-12' },
    // Leg 3: DEL→MAA  09:45–12:30
    { id: 'DS-153', aircraftId: 'VT-AAL', origin: 'DEL', destination: 'MAA', scheduledDeparture: 585, scheduledArrival: 750, passengerCount: 172, sequenceInRotation: 2, crewId: 'CREW-12' },
    // Leg 4: MAA→DEL  13:15–16:00
    { id: 'DS-154', aircraftId: 'VT-AAL', origin: 'MAA', destination: 'DEL', scheduledDeparture: 795, scheduledArrival: 960, passengerCount: 169, sequenceInRotation: 3, crewId: 'CREW-12' },

    // -----------------------------------------------------------------------
    // VT-AAM: HYD hub — 4 legs   HYD→BLR→HYD→BOM→AMD
    // ★BOM★ Leg 3 flies HYD→BOM arriving 14:45 — DURING closure
    // -----------------------------------------------------------------------
    // Leg 1: HYD→BLR  07:00–08:00
    { id: 'DS-155', aircraftId: 'VT-AAM', origin: 'HYD', destination: 'BLR', scheduledDeparture: 420, scheduledArrival: 480, passengerCount: 160, sequenceInRotation: 0, crewId: 'CREW-13' },
    // Leg 2: BLR→HYD  08:30–09:30
    { id: 'DS-156', aircraftId: 'VT-AAM', origin: 'BLR', destination: 'HYD', scheduledDeparture: 510, scheduledArrival: 570, passengerCount: 157, sequenceInRotation: 1, crewId: 'CREW-13' },
    // Leg 3: HYD→BOM  12:30–14:45  ★BOM★ Arrives BOM at 14:45 — DURING closure (885)
    { id: 'DS-157', aircraftId: 'VT-AAM', origin: 'HYD', destination: 'BOM', scheduledDeparture: 750, scheduledArrival: 885, passengerCount: 171, sequenceInRotation: 2, crewId: 'CREW-13' },
    // Leg 4: BOM→AMD  15:30–16:45  ★ Departs BOM at 15:30 — blocked/delayed by closure
    { id: 'DS-158', aircraftId: 'VT-AAM', origin: 'BOM', destination: 'AMD', scheduledDeparture: 930, scheduledArrival: 1005, passengerCount: 154, sequenceInRotation: 3, crewId: 'CREW-13' },

    // -----------------------------------------------------------------------
    // VT-AAN: BOM hub — 4 legs   BOM→GOI→BOM→CCU→BOM
    // ★BOM★ Leg 2 arrives BOM at 14:00 — right at closure start
    // -----------------------------------------------------------------------
    // Leg 1: BOM→GOI  08:30–09:30
    { id: 'DS-159', aircraftId: 'VT-AAN', origin: 'BOM', destination: 'GOI', scheduledDeparture: 510, scheduledArrival: 570, passengerCount: 157, sequenceInRotation: 0, crewId: 'CREW-14' },
    // Leg 2: GOI→BOM  10:00–11:00
    { id: 'DS-160', aircraftId: 'VT-AAN', origin: 'GOI', destination: 'BOM', scheduledDeparture: 600, scheduledArrival: 660, passengerCount: 155, sequenceInRotation: 1, crewId: 'CREW-14' },
    // Leg 3: BOM→CCU  13:30–16:00  ★BOM★ Departs BOM at 13:30 — just before closure
    { id: 'DS-161', aircraftId: 'VT-AAN', origin: 'BOM', destination: 'CCU', scheduledDeparture: 810, scheduledArrival: 960, passengerCount: 174, sequenceInRotation: 2, crewId: 'CREW-14' },
    // Leg 4: CCU→BOM  16:45–19:15
    { id: 'DS-162', aircraftId: 'VT-AAN', origin: 'CCU', destination: 'BOM', scheduledDeparture: 1005, scheduledArrival: 1155, passengerCount: 168, sequenceInRotation: 3, crewId: 'CREW-14' },

    // -----------------------------------------------------------------------
    // VT-AAO: CCU hub — 4 legs   CCU→GAU→CCU→BLR→CCU
    // -----------------------------------------------------------------------
    // Leg 1: CCU→GAU  08:00–09:30
    { id: 'DS-163', aircraftId: 'VT-AAO', origin: 'CCU', destination: 'GAU', scheduledDeparture: 480, scheduledArrival: 570, passengerCount: 155, sequenceInRotation: 0, crewId: 'CREW-06' },
    // Leg 2: GAU→CCU  10:00–11:30
    { id: 'DS-164', aircraftId: 'VT-AAO', origin: 'GAU', destination: 'CCU', scheduledDeparture: 600, scheduledArrival: 690, passengerCount: 152, sequenceInRotation: 1, crewId: 'CREW-06' },
    // Leg 3: CCU→BLR  12:00–14:30
    { id: 'DS-165', aircraftId: 'VT-AAO', origin: 'CCU', destination: 'BLR', scheduledDeparture: 720, scheduledArrival: 870, passengerCount: 170, sequenceInRotation: 2, crewId: 'CREW-06' },
    // Leg 4: BLR→CCU  15:00–17:30
    { id: 'DS-166', aircraftId: 'VT-AAO', origin: 'BLR', destination: 'CCU', scheduledDeparture: 900, scheduledArrival: 1050, passengerCount: 165, sequenceInRotation: 3, crewId: 'CREW-06' },

    // -----------------------------------------------------------------------
    // VT-AAP: BOM hub — 4 legs   BOM→HYD→BOM→GOI→BOM
    // ★BOM★ Leg 2 arrives BOM at 14:15, Leg 3 departs BOM at 14:45
    // -----------------------------------------------------------------------
    // Leg 1: BOM→HYD  06:00–07:45
    { id: 'DS-167', aircraftId: 'VT-AAP', origin: 'BOM', destination: 'HYD', scheduledDeparture: 360, scheduledArrival: 465, passengerCount: 162, sequenceInRotation: 0, crewId: 'CREW-07' },
    // Leg 2: HYD→BOM  11:00–13:00
    { id: 'DS-168', aircraftId: 'VT-AAP', origin: 'HYD', destination: 'BOM', scheduledDeparture: 660, scheduledArrival: 780, passengerCount: 170, sequenceInRotation: 1, crewId: 'CREW-07' },
    // Leg 3: BOM→GOI  14:00–15:00  ★BOM★ Departs BOM at 14:00 — EXACTLY at closure start (840)
    { id: 'DS-169', aircraftId: 'VT-AAP', origin: 'BOM', destination: 'GOI', scheduledDeparture: 840, scheduledArrival: 900, passengerCount: 158, sequenceInRotation: 2, crewId: 'CREW-07' },
    // Leg 4: GOI→BOM  15:30–16:30  ★ Cascades because Leg 3 delayed
    { id: 'DS-170', aircraftId: 'VT-AAP', origin: 'GOI', destination: 'BOM', scheduledDeparture: 930, scheduledArrival: 990, passengerCount: 155, sequenceInRotation: 3, crewId: 'CREW-07' },
  ],

  // =========================================================================
  // AIRCRAFT — 16 aircraft with their rotations
  // =========================================================================
  aircraft: [
    // 6 aircraft with 5 flights each
    { id: 'VT-AAA', type: 'A320', rotation: ['DS-101', 'DS-102', 'DS-103', 'DS-104', 'DS-105'], baseAirport: 'BOM' },
    { id: 'VT-AAB', type: 'A320', rotation: ['DS-106', 'DS-107', 'DS-108', 'DS-109', 'DS-110'], baseAirport: 'DEL' },
    { id: 'VT-AAC', type: 'A320', rotation: ['DS-111', 'DS-112', 'DS-113', 'DS-114', 'DS-115'], baseAirport: 'BOM' },
    { id: 'VT-AAD', type: 'A320', rotation: ['DS-116', 'DS-117', 'DS-118', 'DS-119', 'DS-120'], baseAirport: 'DEL' },
    { id: 'VT-AAE', type: 'A320', rotation: ['DS-121', 'DS-122', 'DS-123', 'DS-124', 'DS-125'], baseAirport: 'BLR' },
    { id: 'VT-AAF', type: 'A320', rotation: ['DS-126', 'DS-127', 'DS-128', 'DS-129', 'DS-130'], baseAirport: 'CCU' },
    // 10 aircraft with 4 flights each
    { id: 'VT-AAG', type: 'A320', rotation: ['DS-131', 'DS-132', 'DS-133', 'DS-134'], baseAirport: 'BOM' },
    { id: 'VT-AAH', type: 'A320', rotation: ['DS-135', 'DS-136', 'DS-137', 'DS-138'], baseAirport: 'HYD' },
    { id: 'VT-AAI', type: 'A320', rotation: ['DS-139', 'DS-140', 'DS-141', 'DS-142'], baseAirport: 'MAA' },
    { id: 'VT-AAJ', type: 'A320', rotation: ['DS-143', 'DS-144', 'DS-145', 'DS-146'], baseAirport: 'DEL' },
    { id: 'VT-AAK', type: 'A320', rotation: ['DS-147', 'DS-148', 'DS-149', 'DS-150'], baseAirport: 'BLR' },
    { id: 'VT-AAL', type: 'A320', rotation: ['DS-151', 'DS-152', 'DS-153', 'DS-154'], baseAirport: 'DEL' },
    { id: 'VT-AAM', type: 'A320', rotation: ['DS-155', 'DS-156', 'DS-157', 'DS-158'], baseAirport: 'HYD' },
    { id: 'VT-AAN', type: 'A320', rotation: ['DS-159', 'DS-160', 'DS-161', 'DS-162'], baseAirport: 'BOM' },
    { id: 'VT-AAO', type: 'A320', rotation: ['DS-163', 'DS-164', 'DS-165', 'DS-166'], baseAirport: 'CCU' },
    { id: 'VT-AAP', type: 'A320', rotation: ['DS-167', 'DS-168', 'DS-169', 'DS-170'], baseAirport: 'BOM' },
  ],

  // =========================================================================
  // CONNECTIONS — 28 passenger connections
  // =========================================================================
  //
  // Connections marked ★BREAK★ will be disrupted by the BOM closure demo.
  //
  // Key cascade connections through BOM:
  //   - Flights arriving BOM during 14:00-15:30 can't connect to outbound
  //   - Outbound flights from BOM delayed → miss connections at destination
  // =========================================================================
  connections: [
    // --- BOM hub connections (most affected by closure) ---

    // DS-102 (DEL→BOM arr 11:30) → DS-103 (BOM→BLR dep 12:00) — 30 min, tight
    { id: 'CX-01', feederFlightId: 'DS-102', onwardFlightId: 'DS-103', passengerCount: 22, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-104 (BLR→BOM arr 15:30) → DS-105 (BOM→HYD dep 16:00) — ★BREAK★ arr delayed by closure
    { id: 'CX-02', feederFlightId: 'DS-104', onwardFlightId: 'DS-105', passengerCount: 18, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-108 (GOI→BOM arr 12:00) → DS-109 (BOM→DEL dep 13:30) — 90 min buffer
    { id: 'CX-03', feederFlightId: 'DS-108', onwardFlightId: 'DS-109', passengerCount: 15, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-112 (MAA→BOM arr 11:30) → DS-113 (BOM→PNQ dep 12:30) — 60 min, OK
    { id: 'CX-04', feederFlightId: 'DS-112', onwardFlightId: 'DS-113', passengerCount: 20, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-114 (PNQ→BOM arr 14:55) → DS-115 (BOM→COK dep 15:30) — ★BREAK★ arr at BOM during closure
    { id: 'CX-05', feederFlightId: 'DS-114', onwardFlightId: 'DS-115', passengerCount: 25, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-141 (MAA→BOM arr 14:30) → DS-142 (BOM→MAA dep 15:15) — ★BREAK★ arr at BOM during closure
    { id: 'CX-06', feederFlightId: 'DS-141', onwardFlightId: 'DS-142', passengerCount: 12, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-145 (DEL→BOM arr 15:00) → DS-146 (BOM→PNQ dep 15:45) — ★BREAK★ arr at BOM during closure
    { id: 'CX-07', feederFlightId: 'DS-145', onwardFlightId: 'DS-146', passengerCount: 20, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-157 (HYD→BOM arr 14:45) → DS-158 (BOM→AMD dep 15:30) — ★BREAK★ arr at BOM during closure
    { id: 'CX-08', feederFlightId: 'DS-157', onwardFlightId: 'DS-158', passengerCount: 16, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-168 (HYD→BOM arr 13:00) → DS-169 (BOM→GOI dep 14:00) — ★BREAK★ dep from BOM at closure start
    { id: 'CX-09', feederFlightId: 'DS-168', onwardFlightId: 'DS-169', passengerCount: 14, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-135 (HYD→BOM arr 09:45) → DS-136 (BOM→HYD dep 13:00) — 195 min, fine
    { id: 'CX-10', feederFlightId: 'DS-135', onwardFlightId: 'DS-136', passengerCount: 10, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-160 (GOI→BOM arr 11:00) → DS-161 (BOM→CCU dep 13:30) — 150 min, fine
    { id: 'CX-11', feederFlightId: 'DS-160', onwardFlightId: 'DS-161', passengerCount: 18, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // DS-132 (AMD→BOM arr 09:30) → DS-136 (BOM→HYD dep 13:00) — 210 min, fine
    { id: 'CX-12', feederFlightId: 'DS-132', onwardFlightId: 'DS-136', passengerCount: 12, minimumConnectTime: 45, connectionAirport: 'BOM' },

    // --- DEL hub connections ---

    // DS-109 (BOM→DEL arr 16:00) → DS-110 (DEL→JAI dep 16:30) — ★BREAK★ cascades from BOM closure
    { id: 'CX-13', feederFlightId: 'DS-109', onwardFlightId: 'DS-110', passengerCount: 24, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-117 (CCU→DEL arr 11:30) → DS-118 (DEL→LKO dep 12:15) — 45 min, tight
    { id: 'CX-14', feederFlightId: 'DS-117', onwardFlightId: 'DS-118', passengerCount: 15, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-119 (LKO→DEL arr 15:30) → DS-120 (DEL→GAU dep 16:15) — 45 min
    { id: 'CX-15', feederFlightId: 'DS-119', onwardFlightId: 'DS-120', passengerCount: 20, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-144 (IXC→DEL arr 09:30) → DS-145 (DEL→BOM dep 12:30) — 180 min buffer
    { id: 'CX-16', feederFlightId: 'DS-144', onwardFlightId: 'DS-145', passengerCount: 10, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-130 (CCU→DEL arr 15:45) → DS-120 (DEL→GAU dep 16:15) — 30 min, tight
    { id: 'CX-17', feederFlightId: 'DS-130', onwardFlightId: 'DS-120', passengerCount: 12, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-152 (JAI→DEL arr 09:00) → DS-153 (DEL→MAA dep 09:45) — 45 min
    { id: 'CX-18', feederFlightId: 'DS-152', onwardFlightId: 'DS-153', passengerCount: 16, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-149 (BLR→DEL arr 13:30) → DS-150 (DEL→BLR dep 14:15) — 45 min
    { id: 'CX-19', feederFlightId: 'DS-149', onwardFlightId: 'DS-150', passengerCount: 14, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // DS-133 (BOM→DEL arr 12:45) → DS-134 (DEL→BOM dep 13:30) — 45 min (same aircraft different crew scenario)
    { id: 'CX-20', feederFlightId: 'DS-133', onwardFlightId: 'DS-150', passengerCount: 11, minimumConnectTime: 45, connectionAirport: 'DEL' },

    // --- BLR hub connections ---

    // DS-122 (HYD→BLR arr 09:00) → DS-123 (BLR→MAA dep 09:30) — 30 min tight
    { id: 'CX-21', feederFlightId: 'DS-122', onwardFlightId: 'DS-123', passengerCount: 15, minimumConnectTime: 45, connectionAirport: 'BLR' },

    // DS-124 (MAA→BLR arr 12:00) → DS-125 (BLR→COK dep 12:30) — 30 min
    { id: 'CX-22', feederFlightId: 'DS-124', onwardFlightId: 'DS-125', passengerCount: 18, minimumConnectTime: 45, connectionAirport: 'BLR' },

    // DS-148 (GOI→BLR arr 10:30) → DS-149 (BLR→DEL dep 11:00) — 30 min
    { id: 'CX-23', feederFlightId: 'DS-148', onwardFlightId: 'DS-149', passengerCount: 12, minimumConnectTime: 45, connectionAirport: 'BLR' },

    // DS-165 (CCU→BLR arr 14:30) → DS-166 (BLR→CCU dep 15:00) — 30 min
    { id: 'CX-24', feederFlightId: 'DS-165', onwardFlightId: 'DS-166', passengerCount: 15, minimumConnectTime: 45, connectionAirport: 'BLR' },

    // --- Other hub connections ---

    // DS-137 (HYD→MAA arr 17:00) → DS-138 (MAA→HYD dep 17:30) — 30 min
    { id: 'CX-25', feederFlightId: 'DS-137', onwardFlightId: 'DS-138', passengerCount: 10, minimumConnectTime: 45, connectionAirport: 'MAA' },

    // DS-127 (BBI→CCU arr 09:30) → DS-128 (CCU→PAT dep 10:00) — 30 min
    { id: 'CX-26', feederFlightId: 'DS-127', onwardFlightId: 'DS-128', passengerCount: 13, minimumConnectTime: 45, connectionAirport: 'CCU' },

    // DS-129 (PAT→CCU arr 12:30) → DS-130 (CCU→DEL dep 13:15) — 45 min
    { id: 'CX-27', feederFlightId: 'DS-129', onwardFlightId: 'DS-130', passengerCount: 17, minimumConnectTime: 45, connectionAirport: 'CCU' },

    // DS-105 (BOM→HYD arr 17:45) → DS-138 (MAA→HYD dep 17:30) — ★BREAK★ cascade: DS-105 delayed → HYD conn
    // Note: This connection is at HYD. Feeder arrives HYD (not MAA). Let me fix.
    // Actually DS-105 goes BOM→HYD. DS-137 goes HYD→MAA dep 15:30. So pax connecting at HYD:
    // DS-105 (BOM→HYD arr 17:45) → next HYD departure? No good one. Let's use a valid one.
    // DS-156 (BLR→HYD arr 09:30) → DS-136 (BOM→HYD dep 13:00) — wrong, DS-136 goes BOM→HYD
    // Let me use: DS-121 (BLR→HYD arr 07:30) → DS-136 (BOM→HYD dep 13:00) — wrong origin
    // Correct HYD connection: a flight arriving HYD connects to a flight departing HYD
    // DS-121 (BLR→HYD arr 07:30) → DS-137 (HYD→MAA dep 15:30) — too long
    // DS-156 (BLR→HYD arr 09:30) → DS-157 (HYD→BOM dep 12:30) — 180 min
    { id: 'CX-28', feederFlightId: 'DS-156', onwardFlightId: 'DS-157', passengerCount: 14, minimumConnectTime: 45, connectionAirport: 'HYD' },
  ],

  // =========================================================================
  // CREWS — 14 crew assignments
  // =========================================================================
  //
  // Duty start = first flight departure - 60 min (pre-flight prep)
  // Max duty = 660 min (11 hours)
  //
  // Crews near their limits (marked ★TIGHT★) will time out when delays cascade.
  // =========================================================================
  crews: [
    // CREW-01: VT-AAA full rotation (DS-101 to DS-105)
    // Duty: 05:00 (300) → DS-105 arr 17:45 (1065). Duration: 765 min ★TIGHT★ over limit!
    // With 660 max, latest allowed end = 300+660 = 960 (16:00). DS-105 arrives 17:45.
    // This crew is already over — set maxDuty higher or split.
    // Let's split: CREW-01 does DS-101, DS-102, DS-103 (until 13:30). CREW-01A does DS-104, DS-105.
    {
      id: 'CREW-01',
      flightIds: ['DS-101', 'DS-102', 'DS-103'],
      dutyStartTime: 300, // 05:00
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },
    // CREW-01A picks up at BLR for the return legs
    // Duty: 13:00 (780) → DS-105 arr 17:45 (1065). Duration: 285 min
    {
      id: 'CREW-01A',
      flightIds: ['DS-104', 'DS-105'],
      dutyStartTime: 780, // 13:00 — 60 min before DS-104 dep at 14:00
      maxDutyMinutes: 660,
      baseAirport: 'BLR',
    },

    // CREW-02: VT-AAB full rotation (DS-106 to DS-110)
    // Duty: 05:30 (330) → DS-110 arr 17:45 (1065). Duration: 735 min ★TIGHT★
    // Split: CREW-02 does DS-106, DS-107, DS-108. CREW-02A does DS-109, DS-110.
    {
      id: 'CREW-02',
      flightIds: ['DS-106', 'DS-107', 'DS-108'],
      dutyStartTime: 330, // 05:30
      maxDutyMinutes: 660,
      baseAirport: 'DEL',
    },
    {
      id: 'CREW-02A',
      flightIds: ['DS-109', 'DS-110'],
      dutyStartTime: 750, // 12:30 — 60 min before DS-109 dep at 13:30
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },

    // CREW-03: VT-AAC (DS-111 to DS-115)
    // Duty: 06:00 (360) → DS-115 arr 17:30 (1050). Duration: 690 min ★TIGHT★
    // Split at leg 4.
    {
      id: 'CREW-03',
      flightIds: ['DS-111', 'DS-112', 'DS-113'],
      dutyStartTime: 360, // 06:00
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },
    {
      id: 'CREW-03A',
      flightIds: ['DS-114', 'DS-115'],
      dutyStartTime: 780, // 13:00 — 60 min before DS-114 dep at 14:00
      maxDutyMinutes: 660,
      baseAirport: 'PNQ',
    },

    // CREW-04: VT-AAD full (DS-116 to DS-120)
    // Duty: 05:00 (300) → DS-120 arr 19:00 (1140). Duration: 840 min — too long.
    // Split: CREW-04 does first 3, CREW-04A does last 2.
    {
      id: 'CREW-04',
      flightIds: ['DS-116', 'DS-117', 'DS-118'],
      dutyStartTime: 300, // 05:00
      maxDutyMinutes: 660,
      baseAirport: 'DEL',
    },
    {
      id: 'CREW-04A',
      flightIds: ['DS-119', 'DS-120'],
      dutyStartTime: 795, // 13:15 — 60 min before DS-119 dep at 14:15
      maxDutyMinutes: 660,
      baseAirport: 'LKO',
    },

    // CREW-05: VT-AAE (DS-121 to DS-125)
    // Duty: 05:30 (330) → DS-125 arr 13:30 (810). Duration: 480 min — OK
    {
      id: 'CREW-05',
      flightIds: ['DS-121', 'DS-122', 'DS-123', 'DS-124', 'DS-125'],
      dutyStartTime: 330, // 05:30
      maxDutyMinutes: 660,
      baseAirport: 'BLR',
    },

    // CREW-06: VT-AAF (DS-126 to DS-130) + VT-AAO (DS-163 to DS-166) — too many flights
    // CREW-06 does VT-AAF, separate crew for VT-AAO.
    // Duty: 06:00 (360) → DS-130 arr 15:45 (945). Duration: 585 min — OK
    {
      id: 'CREW-06',
      flightIds: ['DS-126', 'DS-127', 'DS-128', 'DS-129', 'DS-130'],
      dutyStartTime: 360, // 06:00
      maxDutyMinutes: 660,
      baseAirport: 'CCU',
    },

    // CREW-06A: VT-AAO (DS-163 to DS-166)
    // Duty: 07:00 (420) → DS-166 arr 17:30 (1050). Duration: 630 min ★TIGHT★ near limit
    {
      id: 'CREW-06A',
      flightIds: ['DS-163', 'DS-164', 'DS-165', 'DS-166'],
      dutyStartTime: 420, // 07:00
      maxDutyMinutes: 660,
      baseAirport: 'CCU',
    },

    // CREW-07: VT-AAG (DS-131 to DS-134) + VT-AAP (DS-167 to DS-170)
    // These share crew but different aircraft. Crew operates:
    // DS-167 (BOM→HYD 06:00-07:45), then DS-131 (BOM→AMD 06:30-07:45) — CONFLICT!
    // Can't share. Split them.
    // CREW-07: VT-AAG only. Duty: 05:30 (330) → DS-134 arr 16:00 (960). Dur: 630 min ★TIGHT★
    {
      id: 'CREW-07',
      flightIds: ['DS-131', 'DS-132', 'DS-133', 'DS-134'],
      dutyStartTime: 330, // 05:30
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },

    // CREW-07A: VT-AAP (DS-167 to DS-170)
    // Duty: 05:00 (300) → DS-170 arr 16:30 (990). Duration: 690 min ★TIGHT★ over limit!
    // Split: CREW-07A does DS-167, DS-168. CREW-07B does DS-169, DS-170.
    {
      id: 'CREW-07A',
      flightIds: ['DS-167', 'DS-168'],
      dutyStartTime: 300, // 05:00
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },
    {
      id: 'CREW-07B',
      flightIds: ['DS-169', 'DS-170'],
      dutyStartTime: 780, // 13:00 — 60 min before DS-169 dep at 14:00
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },

    // CREW-08: VT-AAH (DS-135 to DS-138)
    // Duty: 07:00 (420) → DS-138 arr 18:45 (1125). Duration: 705 min ★TIGHT★ over limit!
    // With any delay from BOM cascade, this crew times out.
    // Keep maxDuty at 660 to trigger the violation on delays.
    {
      id: 'CREW-08',
      flightIds: ['DS-135', 'DS-136', 'DS-137', 'DS-138'],
      dutyStartTime: 420, // 07:00
      maxDutyMinutes: 660,
      baseAirport: 'HYD',
    },

    // CREW-09: VT-AAI (DS-139 to DS-142)
    // Duty: 06:30 (390) → DS-142 arr 17:15 (1035). Duration: 645 min — just under ★TIGHT★
    {
      id: 'CREW-09',
      flightIds: ['DS-139', 'DS-140', 'DS-141', 'DS-142'],
      dutyStartTime: 390, // 06:30
      maxDutyMinutes: 660,
      baseAirport: 'MAA',
    },

    // CREW-10: VT-AAJ (DS-143 to DS-146)
    // Duty: 06:00 (360) → DS-146 arr 16:45 (1005). Duration: 645 min — just under ★TIGHT★
    {
      id: 'CREW-10',
      flightIds: ['DS-143', 'DS-144', 'DS-145', 'DS-146'],
      dutyStartTime: 360, // 06:00
      maxDutyMinutes: 660,
      baseAirport: 'DEL',
    },

    // CREW-11: VT-AAK (DS-147 to DS-150)
    // Duty: 07:00 (420) → DS-150 arr 16:45 (1005). Duration: 585 min — OK
    {
      id: 'CREW-11',
      flightIds: ['DS-147', 'DS-148', 'DS-149', 'DS-150'],
      dutyStartTime: 420, // 07:00
      maxDutyMinutes: 660,
      baseAirport: 'BLR',
    },

    // CREW-12: VT-AAL (DS-151 to DS-154)
    // Duty: 05:00 (300) → DS-154 arr 16:00 (960). Duration: 660 min — EXACTLY at limit ★TIGHT★
    {
      id: 'CREW-12',
      flightIds: ['DS-151', 'DS-152', 'DS-153', 'DS-154'],
      dutyStartTime: 300, // 05:00
      maxDutyMinutes: 660,
      baseAirport: 'DEL',
    },

    // CREW-13: VT-AAM (DS-155 to DS-158)
    // Duty: 06:00 (360) → DS-158 arr 16:45 (1005). Duration: 645 min ★TIGHT★
    {
      id: 'CREW-13',
      flightIds: ['DS-155', 'DS-156', 'DS-157', 'DS-158'],
      dutyStartTime: 360, // 06:00
      maxDutyMinutes: 660,
      baseAirport: 'HYD',
    },

    // CREW-14: VT-AAN (DS-159 to DS-162)
    // Duty: 07:30 (450) → DS-162 arr 19:15 (1155). Duration: 705 min ★TIGHT★ over limit!
    // Split: CREW-14 does DS-159, DS-160, DS-161. CREW-14A does DS-162.
    {
      id: 'CREW-14',
      flightIds: ['DS-159', 'DS-160', 'DS-161'],
      dutyStartTime: 450, // 07:30
      maxDutyMinutes: 660,
      baseAirport: 'BOM',
    },
    {
      id: 'CREW-14A',
      flightIds: ['DS-162'],
      dutyStartTime: 945, // 15:45 — 60 min before DS-162 dep at 16:45
      maxDutyMinutes: 660,
      baseAirport: 'CCU',
    },
  ],

  // =========================================================================
  // SPARE AIRCRAFT — 4 spares at major hubs
  // =========================================================================
  spares: [
    { aircraftId: 'VT-SP1', airport: 'BOM', availableFrom: 360, type: 'A320' },  // 06:00
    { aircraftId: 'VT-SP2', airport: 'DEL', availableFrom: 420, type: 'A320' },  // 07:00
    { aircraftId: 'VT-SP3', airport: 'BLR', availableFrom: 480, type: 'A320' },  // 08:00
    { aircraftId: 'VT-SP4', airport: 'HYD', availableFrom: 540, type: 'A320' },  // 09:00
  ],
};
