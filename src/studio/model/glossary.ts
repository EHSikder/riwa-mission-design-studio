/**
 * The studio's glossary (docs/03 §9): the words of mission design, each in a sentence or two a 14-year-old can
 * follow, with why it matters to the mission. Plain words first, the jargon in brackets.
 */
export interface Term {
  term: string;
  plain: string;
  why: string;
}

export const GLOSSARY: Term[] = [
  { term: 'Altitude', plain: 'How high above the ground the spacecraft flies.', why: 'Lower means sharper pictures and stronger radio links, but more air drag and a narrower view.' },
  { term: 'Orbit period', plain: 'The time to go once around. About 95 minutes in low orbit, exactly one day in geostationary orbit.', why: 'It sets how often the spacecraft passes over a place and how many eclipses it rides through.' },
  { term: 'Inclination (tilt)', plain: 'The angle between the orbit and the equator. The ground track reaches that latitude north and south.', why: 'A tilt matching your country\'s latitude passes over it far more often.' },
  { term: 'Sun-synchronous orbit', plain: 'A near-polar orbit that crosses each place at the same local time every day, because Earth\'s bulge slowly turns it with the Sun.', why: 'Every picture has the same lighting, which makes changes easy to spot.' },
  { term: 'Geostationary orbit (GEO)', plain: 'An orbit 35 786 km above the equator that takes exactly one day: the satellite seems to hang still in the sky.', why: 'Fixed dishes on the ground can point at it forever, which is why TV satellites live there.' },
  { term: 'Eclipse', plain: 'The time the spacecraft spends in Earth\'s (or the Moon\'s) shadow, with no sunlight for its solar cells.', why: 'The battery must carry the whole spacecraft through every eclipse.' },
  { term: 'Depth of discharge', plain: 'How much of the battery is used in one eclipse.', why: 'Deep drains wear a battery out in a few years; gentle ones let it last.' },
  { term: 'Δv (delta-v)', plain: 'How much the spacecraft must change its speed (in m/s) to reach, keep or leave its orbit.', why: 'Every m/s costs propellant. Some missions carry more propellant than spacecraft.' },
  { term: 'Specific impulse (Isp)', plain: 'How much push an engine gets from each kilogram of propellant.', why: 'A higher Isp needs less propellant for the same Δv. Electric engines are about 7× better, but very gentle.' },
  { term: 'Payload', plain: 'The part of the spacecraft that does the customer\'s job: cameras, radars, transponders.', why: 'Everything else (the bus) exists to power, point and talk for the payload.' },
  { term: 'Launch capacity', plain: 'How much mass a rocket can lift to a given orbit.', why: 'The spacecraft, with its propellant, must weigh less, or it cannot be launched.' },
  { term: 'Ground resolution (pixel size)', plain: 'The size on the ground of one pixel of an image (ground sample distance).', why: '30 m pixels show fields; 1 m pixels show cars. Sharper cameras see a narrower strip.' },
  { term: 'Swath', plain: 'The width of the strip of ground an instrument sees as it flies.', why: 'A wider swath covers a country faster and comes back to each place more often.' },
  { term: 'Revisit time', plain: 'How long until the spacecraft can look at the same place again.', why: 'Floods and crops change in days: a slow revisit misses them. Clouds make it longer.' },
  { term: 'Data rate', plain: 'How many bits per second a radio link carries (kbps, Mbps, Gbps).', why: 'Instruments make data faster than most links can send it: the link decides what reaches the ground.' },
  { term: 'Link budget', plain: 'The sum of radio gains and losses between the spacecraft and the ground: transmitter power, antennas, distance, receiver.', why: 'It tells you the data rate. Twice the distance means a quarter of the signal.' },
  { term: 'Ground station contact', plain: 'The minutes a satellite is above a ground station\'s horizon and can talk to it.', why: 'Low-orbit satellites only reach a station a few times a day, for a few minutes each time.' },
  { term: 'Latency', plain: 'The delay between taking a picture and having it on the ground.', why: 'Rescue teams need flood pictures within hours, not days.' },
  { term: 'Margin', plain: 'What is left between what you need and what you have: mass, power, money, time.', why: 'Designs always grow and surprises happen: no margin, no room to fix them.' },
  { term: 'Reserve', plain: 'Money set aside at the start for problems nobody has found yet.', why: 'Almost every space project needs it; what is left at the end counts as savings.' },
  { term: 'TRL (technology readiness)', plain: 'A 1-to-9 score of how proven a technology is: 9 has flown, below 7 is still being tested.', why: 'New technology takes longer, weighs more than planned and is riskier.' },
  { term: 'Redundancy', plain: 'Carrying a spare of a critical part, ready to take over.', why: 'It turns a mission-ending failure into a short interruption, for extra mass and cost.' },
  { term: 'Radiation dose', plain: 'The energy the radiation belts and cosmic rays deposit in the electronics over the years (in krad).', why: 'Every chip survives only so much: tougher chips last longer in harsh orbits.' },
  { term: 'Launch window', plain: 'The days when the planets line up so a spacecraft can reach its target cheaply. For Mars, every 26 months.', why: 'Miss the window and you wait two more years.' },
  { term: 'Aerobraking', plain: 'Slowing down by skimming the top of a planet\'s atmosphere many times, instead of firing the engine.', why: 'It saves a tonne of propellant at Mars, but takes months.' },
  { term: 'Rain fade', plain: 'Heavy rain absorbs high-frequency radio signals.', why: 'Ku- and Ka-band TV can freeze in a tropical storm; C-band barely notices.' },
  { term: 'Throughput', plain: 'How much traffic (Gbps) a communications satellite can relay at once.', why: 'It is what a telecom satellite sells.' },
  { term: 'Halo orbit', plain: 'A loop around a balance point in space, such as the one beyond the far side of the Moon.', why: 'From there a relay sees both the far side and the Earth.' },
];
