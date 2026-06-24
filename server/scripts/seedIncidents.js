/**
 * seedIncidents.js — Populate MongoDB with 65 realistic Chandigarh incident data points.
 * USAGE: node scripts/seedIncidents.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const User = require('../models/User');

const SEED_INCIDENTS = [
  // ─── POOR LIGHTING (35% = 23 Incidents) ──────────────────────────────────────
  {
    title: "Broken Streetlights near Plaza",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7412, lng: 76.7792, // Sector 17
    description: "Multiple decorative and street lights around Sector 17 Plaza outer ring have been non-functional since the monsoon. Walkways are dark after 8pm.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.9,
    confirmations: 4,
    affectsGroups: ["women", "tourists", "students"],
    ageDays: 14
  },
  {
    title: "Unlit Underpass Sector 25",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7521, lng: 76.7538, // Sector 25
    description: "Pedestrian underpass connecting PU Campus to Sector 25 is completely dark at night. No working overhead lamps inside.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.7,
    confirmations: 2,
    affectsGroups: ["students", "women"],
    ageDays: 5
  },
  {
    title: "Sector 22 Market Alley Dark",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7328, lng: 76.7725, // Sector 22
    description: "Backside service lanes behind the mobile market are extremely poorly lit. Shadows create unsafe spots for late-night shoppers.",
    source: "SafeRoute Community Report",
    confidenceScore: 1.0,
    confirmations: 5,
    affectsGroups: ["women", "tourists"],
    ageDays: 22
  },
  {
    title: "Industrial Area Phase 1 Outer Road Unlit",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7065, lng: 76.8020, // Industrial Area Phase 1
    description: "Streetlights along the warehouse stretch are broken or missing. Shift workers face low visibility during late hours.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.90,
    affectsGroups: ["night_workers"],
    ageDays: 45
  },
  {
    title: "Dark Stretch near Burail Boundary",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7225, lng: 76.7612, // Burail
    description: "Boundary road near Sector 45 is dark due to tree canopy covering the few functional streetlights. Pedestrians report feeling unsafe.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.68,
    affectsGroups: ["women", "students"],
    ageDays: 12
  },
  {
    title: "Hallomajra Chowk Blackout",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7315, lng: 76.8485, // Hallomajra
    description: "Entire intersection street lights are out. High risk of accidents and low personal safety visibility near the highway crossing.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.88,
    affectsGroups: ["night_workers", "tourists"],
    ageDays: 30
  },
  {
    title: "Sarangpur Road Unlit Path",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7025, lng: 76.7875, // Sarangpur
    description: "Rural peripheral road lacks street lighting infrastructure. High beams from trucks make walking on the side dangerous at night.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.60,
    affectsGroups: ["night_workers"],
    ageDays: 60
  },
  {
    title: "Daria Village Back Road Dark",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7125, lng: 76.8205, // Daria
    description: "Narrow lanes connecting Daria to the railway station have no street lighting. Walking alone is highly discouraged after sunset.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.72,
    affectsGroups: ["tourists", "women"],
    ageDays: 8
  },
  {
    title: "Sector 35 Inner Park Dark Spots",
    type: "poor_lighting",
    severity: "low",
    lat: 30.7215, lng: 76.7645, // Sector 35
    description: "The central park walk path has three consecutive broken lampposts. Creates large shadows during early morning and late evening walks.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.75,
    affectsGroups: ["women", "students"],
    ageDays: 3
  },
  {
    title: "Mauli Jagran Main Road Outage",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7015, lng: 76.8455, // Mauli Jagran
    description: "Local residents report that the main streetlights on the bridge section have been off for three weeks. Multiple complaints filed.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.95,
    affectsGroups: ["night_workers", "students"],
    ageDays: 20
  },
  {
    title: "PGI Back Gate Corridor Dark",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7648, lng: 76.7752, // PGI Area
    description: "The corridor connecting the main ward exit to the local residential block is pitch black at night. High concern for hospital staff.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.78,
    affectsGroups: ["women", "night_workers", "students"],
    ageDays: 17
  },
  {
    title: "Manimajra Housing Board Crossing Dark",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7278, lng: 76.8535, // Manimajra
    description: "Light poles at the housing board crossing are obscured by overgrown trees, casting the pedestrian sidewalks in deep darkness.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.80,
    affectsGroups: ["women", "students"],
    ageDays: 40
  },
  {
    title: "Sector 43 Bus Stand Outer Wall Dark",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7068, lng: 76.7525, // Sector 43
    description: "The footpath along the outer boundary wall of ISBT 43 has zero functional lights. Passengers are forced to walk in the dark to catch auto-rickshaws.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.70,
    affectsGroups: ["tourists", "women"],
    ageDays: 2
  },
  {
    title: "Industrial Area Phase 2 Service Lane Unlit",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.6975, lng: 76.7995, // Industrial Area Phase 2
    description: "Service lane behind the automobile showrooms is dark. Security guards report low visibility during rounds.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.65,
    affectsGroups: ["night_workers"],
    ageDays: 55
  },
  {
    title: "Sector 25 Crematorium Road Dark",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7495, lng: 76.7542, // Sector 25
    description: "Extremely isolated road leading past the crematorium has no lights at all. High risk corridor at night.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.90,
    affectsGroups: ["women", "students"],
    ageDays: 32
  },
  {
    title: "Sector 35-C Inner Residential Lane Dark",
    type: "poor_lighting",
    severity: "low",
    lat: 30.7238, lng: 76.7628, // Sector 35
    description: "Tree branches have blocked the streetlamp near House 1450. Lane is noticeably darker than adjoining streets.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.82,
    affectsGroups: ["women"],
    ageDays: 1
  },
  {
    title: "Sector 22-A Residential Block Dark",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7348, lng: 76.7712, // Sector 22
    description: "Internal lanes of Sector 22-A have three non-functional lamps. Residents complain about walking dogs late at night.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.71,
    affectsGroups: ["women", "students"],
    ageDays: 28
  },
  {
    title: "PEC Campus Boundary Road Dark",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7635, lng: 76.7865, // PGI/PEC Area
    description: "The road running along the PEC boundary wall towards the forest area has no functional streetlights. Very dark after 9pm.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.64,
    affectsGroups: ["students", "women"],
    ageDays: 6
  },
  {
    title: "Daria Bridge Approach Road Unlit",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7112, lng: 76.8228, // Daria
    description: "The stretch approaching the Daria underpass has broken lighting fixtures. Hard to spot pedestrians or cyclists.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.86,
    affectsGroups: ["tourists", "night_workers"],
    ageDays: 11
  },
  {
    title: "Hallomajra Internal Gali Blackout",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7302, lng: 76.8465, // Hallomajra
    description: "Internal alleyway lighting is down. Narrow lanes are completely dark, causing safety concerns for families and shift workers returning home.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.69,
    affectsGroups: ["women", "night_workers"],
    ageDays: 19
  },
  {
    title: "Manimajra Shivalik Enclave Road Dark",
    type: "poor_lighting",
    severity: "medium",
    lat: 30.7292, lng: 76.8552, // Manimajra
    description: "Main approach road to Shivalik Enclave has dim lighting. The yellow sodium lights are failing and provide poor coverage.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.81,
    affectsGroups: ["women", "students"],
    ageDays: 50
  },
  {
    title: "Sector 43-B Internal Loop Dark",
    type: "poor_lighting",
    severity: "low",
    lat: 30.7092, lng: 76.7548, // Sector 43
    description: "Two streetlights on the inner residential curve are flickering and dim. Reported by local neighborhood watch.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.74,
    affectsGroups: ["women"],
    ageDays: 9
  },
  {
    title: "Sector 17 Bus Stand Back Lane Dark",
    type: "poor_lighting",
    severity: "high",
    lat: 30.7428, lng: 76.7818, // Sector 17
    description: "The pedestrian path behind the Sector 17 ISBT is unlit. Commuters exiting towards the main market face dark stretches.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.77,
    affectsGroups: ["tourists", "women", "night_workers"],
    ageDays: 4
  },

  // ─── THEFT / CHAIN SNATCHING (25% = 16 Incidents) ───────────────────────────
  {
    title: "Chain Snatching at Sector 15-16 Roundabout",
    type: "theft",
    severity: "high",
    lat: 30.7432, lng: 76.7872, // Sector 15/16
    description: "Two men on a motorcycle snatched a gold chain from a woman returning from the market at 8:30pm. Police patrolling has been requested.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.98,
    affectsGroups: ["women", "students"],
    ageDays: 10
  },
  {
    title: "Mobile Snatching near Sector 22 Market",
    type: "theft",
    severity: "high",
    lat: 30.7330, lng: 76.7735, // Sector 22
    description: "A pedestrian's mobile phone was snatched while walking and talking near the Sector 22 Shastri Market periphery. Suspects fled on a scooter.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.95,
    affectsGroups: ["tourists", "women", "students"],
    ageDays: 3
  },
  {
    title: "Bicycle Theft at Sector 35 Market Parking",
    type: "theft",
    severity: "medium",
    lat: 30.7228, lng: 76.7632, // Sector 35
    description: "Lock-cut bicycle theft reported from the rear parking lot of Sector 35-C commercial block between 6pm and 8pm.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.80,
    affectsGroups: ["students"],
    ageDays: 15
  },
  {
    title: "Wallet Theft at Sector 43 ISBT",
    type: "theft",
    severity: "medium",
    lat: 30.7075, lng: 76.7532, // Sector 43
    description: "Pickpocketing reported at the boarding platform of Sector 43 Bus Stand. Victims note crowded queues are targeted.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.92,
    affectsGroups: ["tourists", "students"],
    ageDays: 25
  },
  {
    title: "Car Break-in Industrial Area Phase 1",
    type: "theft",
    severity: "high",
    lat: 30.7058, lng: 76.8015, // Industrial Area Phase 1
    description: "Window glass shattered and laptop bag stolen from a parked car near Elante Mall back parking lane at 9:30pm.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.96,
    affectsGroups: ["night_workers", "tourists"],
    ageDays: 35
  },
  {
    title: "Bag Snatching near Burail Petrol Pump",
    type: "theft",
    severity: "high",
    lat: 30.7218, lng: 76.7595, // Burail
    description: "Laptop bag snatched from a student walking back to their PG. The assailant approached from behind on a black motorcycle without a license plate.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.76,
    affectsGroups: ["students", "women"],
    ageDays: 7
  },
  {
    title: "Chain Snatching at Sector 35 Residential Park",
    type: "theft",
    severity: "high",
    lat: 30.7202, lng: 76.7658, // Sector 35
    description: "Elderly woman targeted by gold chain snatchers during an evening walk. Incident occurred in the residential park under low light conditions.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.97,
    affectsGroups: ["women"],
    ageDays: 18
  },
  {
    title: "Mobile Theft from PGI Waiting Hall",
    type: "theft",
    severity: "medium",
    lat: 30.7652, lng: 76.7765, // PGI Area
    description: "Patient attendant reported their phone stolen while sleeping in the OPD waiting hall. High crowds and lack of security check noted.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.70,
    affectsGroups: ["tourists"],
    ageDays: 29
  },
  {
    title: "Pickpocketing near Hallomajra Bus Stop",
    type: "theft",
    severity: "medium",
    lat: 30.7322, lng: 76.8492, // Hallomajra
    description: "Wallet and cash stolen from a commuter while boarding a crowded local bus. Several pickpocketing incidents reported at this spot.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.74,
    affectsGroups: ["night_workers", "students"],
    ageDays: 41
  },
  {
    title: "Bag Theft from Auto-Rickshaw near Railway Station",
    type: "theft",
    severity: "high",
    lat: 30.7032, lng: 76.8212, // Daria / Station Area
    description: "Luggage bag stolen from the back of a shared auto-rickshaw while waiting at the red light near the railway crossing.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.94,
    affectsGroups: ["tourists"],
    ageDays: 50
  },
  {
    title: "Motorcycle Theft Mauli Jagran Parking",
    type: "theft",
    severity: "high",
    lat: 30.7022, lng: 76.8468, // Mauli Jagran
    description: "A locked motorcycle was stolen from outside the residential complex overnight. Police FIR registered.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.99,
    affectsGroups: ["night_workers"],
    ageDays: 62
  },
  {
    title: "Mobile Snatching near Manimajra Market Entrance",
    type: "theft",
    severity: "high",
    lat: 30.7282, lng: 76.8548, // Manimajra
    description: "Victim's phone snatched from their hand by a pedestrian who fled into the narrow inner lanes of Manimajra town.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.68,
    affectsGroups: ["women", "students"],
    ageDays: 13
  },
  {
    title: "Bag Snatching Sector 25 Student PG Area",
    type: "theft",
    severity: "high",
    lat: 30.7505, lng: 76.7512, // Sector 25
    description: "Two youths on a scooter snatched a bag containing books and a laptop from a student walking to the campus at 7:45pm.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.78,
    affectsGroups: ["students", "women"],
    ageDays: 21
  },
  {
    title: "Wallet Pickpocketing Sector 17 Plaza",
    type: "theft",
    severity: "medium",
    lat: 30.7418, lng: 76.7788, // Sector 17
    description: "Wallet stolen from back pocket in front of the food stalls in the main Plaza during peak weekend crowds.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.81,
    affectsGroups: ["tourists"],
    ageDays: 32
  },
  {
    title: "Laptop Theft from Cafe in Sector 35",
    type: "theft",
    severity: "medium",
    lat: 30.7218, lng: 76.7618, // Sector 35
    description: "Unattended laptop snatched from a study table while the user went to collect their order. CCTV footage handed to police.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.93,
    affectsGroups: ["students"],
    ageDays: 16
  },
  {
    title: "Chain Snatching Sector 22 Residential Inner Gate",
    type: "theft",
    severity: "high",
    lat: 30.7338, lng: 76.7705, // Sector 22
    description: "Gold necklace snatched from an elderly resident entering their gate. The suspect was waiting in the shadows near the unlit block gate.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.97,
    affectsGroups: ["women"],
    ageDays: 44
  },

  // ─── HARASSMENT (20% = 13 Incidents) ────────────────────────────────────────
  {
    title: "Catcalling & Harassment Sector 15 Market Lane",
    type: "harassment",
    severity: "high",
    lat: 30.7418, lng: 76.7885, // Sector 15
    description: "Group of drunk men gathered near the local food stalls passed offensive comments and blocked path for female students at 9pm.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.78,
    affectsGroups: ["women", "students"],
    ageDays: 4
  },
  {
    title: "Eve Teasing near PU Sector 25 Gate",
    type: "harassment",
    severity: "high",
    lat: 30.7512, lng: 76.7548, // Sector 25
    description: "Repeated instances of slow-moving cars passing comments at female students walking between the university departments and Sector 25 hostel gate.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.82,
    affectsGroups: ["women", "students"],
    ageDays: 9
  },
  {
    title: "Harassment near Elante Mall Outer Corridor",
    type: "harassment",
    severity: "medium",
    lat: 30.7052, lng: 76.8028, // Industrial Area Phase 1
    description: "Women reported being followed and stared at by a group of loiterers near the outer road bus stand after leaving the mall late night.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.70,
    affectsGroups: ["women", "tourists"],
    ageDays: 14
  },
  {
    title: "Verbal Abuse near Burail Market",
    type: "harassment",
    severity: "medium",
    lat: 30.7220, lng: 76.7605, // Burail
    description: "Drunk individuals passing obscene comments and blocking the narrow street paths near the local wine shop. Highly unsafe for solo women walkers.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.75,
    affectsGroups: ["women"],
    ageDays: 20
  },
  {
    title: "Stalking Incident near Sector 35 Coaching Centers",
    type: "harassment",
    severity: "high",
    lat: 30.7230, lng: 76.7620, // Sector 35
    description: "A female student reported being stalked all the way from the library to the Sector 35 bus stop by an unidentified man on foot.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.80,
    affectsGroups: ["women", "students"],
    ageDays: 2
  },
  {
    title: "Harassment by Auto Drivers at Railway Station Exit",
    type: "harassment",
    severity: "medium",
    lat: 30.7042, lng: 76.8220, // Daria / Railway Station
    description: "Aggressive auto-rickshaw drivers surrounding solo female travelers, passing comments, and pulling bags at the railway station exit.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.73,
    affectsGroups: ["women", "tourists"],
    ageDays: 27
  },
  {
    title: "Drunk Men Loitering near Hallomajra Bridge",
    type: "harassment",
    severity: "high",
    lat: 30.7308, lng: 76.8475, // Hallomajra
    description: "Constant presence of drunk loiterers under the bridge who pass remarks and hurl verbal abuse at pedestrians crossing the bridge after 8pm.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.67,
    affectsGroups: ["women", "night_workers"],
    ageDays: 31
  },
  {
    title: "Group Harassment near Sector 43 ISBT Subway",
    type: "harassment",
    severity: "high",
    lat: 30.7062, lng: 76.7518, // Sector 43
    description: "A group of youths blocked the exit of the pedestrian subway, making crude gestures and passing remarks at women passing through.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.96,
    affectsGroups: ["women", "tourists", "students"],
    ageDays: 38
  },
  {
    title: "Following incident near Sector 17 Inner Parking",
    type: "harassment",
    severity: "medium",
    lat: 30.7402, lng: 76.7802, // Sector 17
    description: "A woman reported being followed closely by two men through the multilevel parking structure. She had to run to security to get help.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.71,
    affectsGroups: ["women", "night_workers"],
    ageDays: 48
  },
  {
    title: "Stalking PU South Campus Path",
    type: "harassment",
    severity: "high",
    lat: 30.7532, lng: 76.7522, // Sector 25
    description: "A female hosteller reported a car following her slowly along the Sector 25 link road, with the occupants rollling down windows to harrass her.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.85,
    affectsGroups: ["women", "students"],
    ageDays: 16
  },
  {
    title: "Eve Teasing near PGI Hospital Gate 2",
    type: "harassment",
    severity: "high",
    lat: 30.7642, lng: 76.7745, // PGI Area
    description: "Night shift nurses complain of youths in cars gathering near Gate 2, playing loud music and passing offensive comments at staff during shift change.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.94,
    affectsGroups: ["women", "night_workers"],
    ageDays: 52
  },
  {
    title: "Verbal Harassment Daria Village Road",
    type: "harassment",
    severity: "high",
    lat: 30.7132, lng: 76.8195, // Daria
    description: "Solo female worker followed and verbally harassed by three men on a motorcycle on the unlit lane connecting to Daria.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.69,
    affectsGroups: ["women", "night_workers"],
    ageDays: 60
  },
  {
    title: "Group Harassment Mauli Jagran Market Boundary",
    type: "harassment",
    severity: "high",
    lat: 30.7008, lng: 76.8448, // Mauli Jagran
    description: "Youths blocking the market exit, passing vulgar comments at women and girls exiting the commercial area in the evenings.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.72,
    affectsGroups: ["women", "students"],
    ageDays: 70
  },

  // ─── ISOLATED AREA / SUSPICIOUS ACTIVITY (20% = 13 Incidents) ────────────────
  {
    title: "Extremely Isolated Stretch near Sector 25 Forest",
    type: "isolated_area",
    severity: "high",
    lat: 30.7548, lng: 76.7528, // Sector 25
    description: "The road behind the dental college is bounded by forest area. No houses or shops are present, and foot traffic is zero after 8pm.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.91,
    affectsGroups: ["students", "women", "night_workers"],
    ageDays: 23
  },
  {
    title: "Drunk Groups near Burail Liquor Vend",
    type: "suspicious_activity",
    severity: "medium",
    lat: 30.7212, lng: 76.7588, // Burail
    description: "Frequent gathering of aggressive and intoxicated groups outside the liquor store. Fights and shouting are common late at night.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.77,
    affectsGroups: ["women", "students"],
    ageDays: 11
  },
  {
    title: "Abandoned Complex near Industrial Area Phase 2",
    type: "isolated_area",
    severity: "medium",
    lat: 30.6965, lng: 76.8005, // Industrial Area Phase 2
    description: "An abandoned factory plot has become a gathering point for drug addicts and suspicious individuals. Avoid walking past this wall.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.95,
    affectsGroups: ["night_workers", "tourists"],
    ageDays: 42
  },
  {
    title: "Isolated Road behind Sector 17 Bus Stand",
    type: "isolated_area",
    severity: "high",
    lat: 30.7435, lng: 76.7828, // Sector 17
    description: "Service lane behind the government office blocks is deserted after office hours (5:30pm). Zero security presence.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.88,
    affectsGroups: ["women", "night_workers"],
    ageDays: 27
  },
  {
    title: "Suspicious Persons near Daria Railway Underpass",
    type: "suspicious_activity",
    severity: "high",
    lat: 30.7108, lng: 76.8218, // Daria
    description: "Reports of men hiding in the shadows under the railway bridge, observing people walking with bags. High probability of robbery setup.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.97,
    affectsGroups: ["tourists", "night_workers"],
    ageDays: 5
  },
  {
    title: "Open Drinking near Hallomajra Playground",
    type: "suspicious_activity",
    severity: "medium",
    lat: 30.7328, lng: 76.8468, // Hallomajra
    description: "Groups of men sit in parked cars and drink alcohol in the dark field bordering the road, shouting at passersby.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.72,
    affectsGroups: ["women", "students"],
    ageDays: 34
  },
  {
    title: "Isolated Footpath near PGI Nursery",
    type: "isolated_area",
    severity: "medium",
    lat: 30.7660, lng: 76.7738, // PGI Area
    description: "The pedestrian sidewalk running past the green nursery is cut off from the main road by high hedges. Very quiet and isolated.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.80,
    affectsGroups: ["women", "night_workers"],
    ageDays: 56
  },
  {
    title: "Suspicious Vehicle Parking near Sector 35 Parks",
    type: "suspicious_activity",
    severity: "medium",
    lat: 30.7222, lng: 76.7652, // Sector 35
    description: "Reports of tinted glass vehicles parked for hours in the residential lanes with occupants drinking inside and observing women.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.66,
    affectsGroups: ["women", "students"],
    ageDays: 9
  },
  {
    title: "Mauli Jagran Railway Track Border",
    type: "isolated_area",
    severity: "high",
    lat: 30.7002, lng: 76.8462, // Mauli Jagran
    description: "Unfenced railway track border lane is extremely isolated and dark. SafeRoute audit suggests avoiding this sector border at night.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.92,
    affectsGroups: ["night_workers"],
    ageDays: 75
  },
  {
    title: "Manimajra Fort Ruins Corridor",
    type: "isolated_area",
    severity: "high",
    lat: 30.7285, lng: 76.8558, // Manimajra
    description: "Corridor leading past the historic ruins is very narrow, dark, and secluded. Commuters advised to stick to the main bazaar road.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.74,
    affectsGroups: ["women", "tourists"],
    ageDays: 18
  },
  {
    title: "Open Drug Use near Sector 25 Dumping Ground",
    type: "suspicious_activity",
    severity: "high",
    lat: 30.7482, lng: 76.7498, // Sector 25
    description: "Sightings of drug paraphernalia and groups of addicts gathering behind the dumping yard wall. Avoid walking alone here.",
    source: "Chandigarh Police Crime Report 2023",
    confidenceScore: 0.99,
    affectsGroups: ["students", "night_workers"],
    ageDays: 21
  },
  {
    title: "Deep Puddle & Open Manhole Road Hazard",
    type: "road_hazard",
    severity: "high",
    lat: 30.7325, lng: 76.7718, // Sector 22
    description: "An open manhole is covered only by a branch in Sector 22. Highly dangerous for two-wheelers and pedestrians in dark hours.",
    source: "SafeRoute Community Report",
    confidenceScore: 0.88,
    affectsGroups: ["students", "women", "tourists"],
    ageDays: 1
  },
  {
    title: "Caving Road Corner Road Hazard",
    type: "road_hazard",
    severity: "medium",
    lat: 30.7082, lng: 76.7538, // Sector 43
    description: "A portion of the road near the market corner has collapsed. No warning signs or barriers are set up. Avoid this lane in the dark.",
    source: "Municipal Safety Audit 2024",
    confidenceScore: 0.85,
    affectsGroups: ["tourists", "night_workers"],
    ageDays: 10
  }
];

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || '';
    const isAtlas = MONGODB_URI.startsWith('mongodb+srv://') || 
                    (MONGODB_URI.startsWith('mongodb://') && MONGODB_URI.includes('.mongodb.net'));
    if (!isAtlas) {
      console.error('❌ MONGODB_URI must be a MongoDB Atlas URI (starts with mongodb+srv:// or contains .mongodb.net). Check server/.env.');
      process.exit(1);
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Create or find the seed user
    let seedUser = await User.findOne({ email: 'seed@saferoute.demo' });
    if (!seedUser) {
      seedUser = await User.create({
        name: 'SafeRoute Seed',
        email: 'seed@saferoute.demo',
        password: 'SafeRoute@2024!',
      });
      console.log('✅ Seed user created');
    }

    // Clear existing seed data from this user
    const deleted = await Incident.deleteMany({ reportedBy: seedUser._id });
    console.log(`🗑️  Removed ${deleted.deletedCount} old seed incidents`);

    // Format all incidents to match schema
    const incidents = SEED_INCIDENTS.map((inc) => {
      // Calculate date based on ageDays
      const reportedDate = new Date(Date.now() - inc.ageDays * 24 * 60 * 60 * 1000);
      return {
        title: inc.title,
        type: inc.type,
        severity: inc.severity,
        description: inc.description,
        location: {
          type: 'Point',
          coordinates: [inc.lng, inc.lat], // [longitude, latitude] GeoJSON order
        },
        reportedBy: seedUser._id,
        source: inc.source,
        confidenceScore: inc.confidenceScore,
        confidence: inc.confidenceScore, // Sync both for safety scoring engine compatibility
        confirmations: inc.confirmations || 0,
        affectsGroups: inc.affectsGroups,
        reportedAt: reportedDate,
        createdAt: reportedDate,
        expiresAt: new Date(reportedDate.getTime() + 90 * 24 * 60 * 60 * 1000), // Expose 90 days out to match date window
      };
    });

    const result = await Incident.insertMany(incidents, { ordered: false });
    console.log(`✅ Inserted ${result.length} safety incidents across Chandigarh successfully.`);
    console.log('🎉 Seed complete! Start the server and test route scoring.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  }
}

seed();
