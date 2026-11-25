// Figure blocks for act.js (v2 layout). Exports a function taking the shape helpers.
module.exports = (h) => {
  const { lane, act, obj, sig, dia, q, g, bar, init, fin, ff, note, page } = h;

  // ───────── Figure 5: submit a waste report (UC-02 with UC-04) ─────────
  {
    const C = 200,
      C2 = 430,
      Rc = 788,
      P = 1170,
      P2 = 1450;
    const body = [
      lane(8, 560, 'Citizen app'),
      lane(576, 424, 'Reports service'),
      lane(1008, 648, 'Processing pipeline'),
      init('i0', C, 60),
      act('a1', C, 82, 220, 32, 'Open the app'),
      act('a2', C, 134, 260, 42, 'Capture 1–5 photos or one video; pick a category'),
      bar('f1', 70, 192, 420),
      act('a3', 140, 214, 170, 32, 'Compress media'),
      dia('d1', C2, 230),
      q(C2 + 18, 240, 'GPS fix?'),
      act('a4', 362, 270, 110, 40, 'Use GPS position'),
      act('a5', 498, 270, 116, 40, 'Set location by hand'),
      dia('m1', C2, 336),
      bar('j1', 70, 362, 420),
      dia('d2', C, 392),
      q(C - 78, 384, 'Online?'),
      act('a6', C2, 376, 190, 32, 'Save to the offline queue'),
      sig('e1', 'accept', C2, 436, 190, 34, 'Connection restored'),
      dia('m3', C, 453),
      act('a7', C, 476, 220, 32, 'Request a new report'),
      act('a8', C, 524, 240, 32, 'Upload media to S3 (resumable)'),
      act('a9', C, 576, 220, 32, 'Submit the report'),
      act('a10', C + 30, 656, 220, 32, 'Show the tracking code'),
      fin('fin1', 64, 672),
      act('r1', Rc, 471, 300, 42, 'Create report record (awaiting media, idempotency key)'),
      act('r2', Rc, 524, 260, 32, 'Return pre-signed upload links'),
      act('r3', Rc, 576, 260, 32, 'Verify every file is in S3'),
      sig('r4', 'send', Rc, 618, 220, 30, 'ReportSubmitted'),
      act('r5', Rc, 656, 300, 32, 'Send SMS confirmation with tracking code'),
      sig('p0', 'accept', P, 52, 200, 32, 'ReportSubmitted'),
      act('p1', P, 102, 230, 32, 'Validate and moderate'),
      dia('dv', P, 160),
      q(P - 104, 152, 'Acceptable?'),
      act('p1r', P2, 144, 230, 32, 'Reject; notify the reporter'),
      ff('ffr', 1610, 160),
      act('p2', P, 196, 230, 32, 'Geocode the location'),
      dia('dd', P, 254),
      q(P - 104, 246, 'Duplicate?'),
      act('p3', P2, 238, 270, 32, 'Link to the parent report (BR-003)'),
      act('p3b', P2, 288, 300, 42, 'Raise parent priority at 3 duplicates (BR-004)'),
      ff('ffd', P2, 360),
      act('p4', P, 290, 230, 40, 'Analyse images (Figure 6)', 'ai', true),
      act('p5', P, 350, 230, 32, 'Create a task'),
      act('p6', P, 402, 250, 32, 'Auto-assign a crew group (BR-005)'),
      act('p6b', P2, 397, 230, 42, 'Prepare an admin recommendation (R4)', 'later'),
      sig('p7', 'send', P, 456, 200, 30, 'TaskAssigned'),
      fin('fin2', P, 518),
      note(
        1030,
        572,
        600,
        '<b>Reading the signals.</b> A send-signal shape and an accept-event shape with the same name are one message. The Reports service publishes ReportSubmitted to the SQS queue and the pipeline worker accepts it. TaskAssigned goes to the event bus, which triggers SMS and push. The rake marks a call to another activity: Figure 6.',
      ),
      g(C2 - 64, 210, 'yes'),
      g(C2 + 22, 210, 'no'),
      g(C + 8, 410, 'yes'),
      g(C + 22, 372, 'no'),
      g(P + 22, 138, 'no'),
      g(P + 8, 174, 'yes'),
      g(P + 22, 234, 'yes'),
      g(P + 8, 272, 'no'),
    ].join('\n');
    const e = [
      [
        [C, 70],
        [C, 82],
      ],
      [
        [C, 114],
        [C, 134],
      ],
      [
        [C, 176],
        [C, 192],
      ],
      [
        [140, 198],
        [140, 214],
      ],
      [
        [C2, 198],
        [C2, 215],
      ],
      [
        [C2 - 15, 230],
        [362, 230],
        [362, 270],
      ],
      [
        [C2 + 15, 230],
        [498, 230],
        [498, 270],
      ],
      [
        [362, 310],
        [362, 336],
        [C2 - 15, 336],
      ],
      [
        [498, 310],
        [498, 336],
        [C2 + 15, 336],
      ],
      [
        [C2, 351],
        [C2, 362],
      ],
      [
        [140, 246],
        [140, 362],
      ],
      [
        [C, 368],
        [C, 377],
      ],
      [
        [C + 15, 392],
        [C2 - 95, 392],
      ],
      [
        [C2, 408],
        [C2, 436],
      ],
      [
        [C2 - 95, 453],
        [C + 15, 453],
      ],
      [
        [C, 407],
        [C, 438],
      ],
      [
        [C, 468],
        [C, 476],
      ],
      [
        [C + 110, 492],
        [Rc - 150, 492],
      ],
      [
        [Rc - 130, 540],
        [C + 120, 540],
      ],
      [
        [C, 556],
        [C, 576],
      ],
      [
        [C + 110, 592],
        [Rc - 130, 592],
      ],
      [
        [Rc, 513],
        [Rc, 524],
      ],
      [
        [Rc, 556],
        [Rc, 576],
      ],
      [
        [Rc, 608],
        [Rc, 618],
      ],
      [
        [Rc, 648],
        [Rc, 656],
      ],
      [
        [Rc - 150, 672],
        [C + 140, 672],
      ],
      [
        [C + 30 - 110, 672],
        [76, 672],
      ],
      [
        [P, 84],
        [P, 102],
      ],
      [
        [P, 134],
        [P, 145],
      ],
      [
        [P + 15, 160],
        [P2 - 115, 160],
      ],
      [
        [P2 + 115, 160],
        [1599, 160],
      ],
      [
        [P, 175],
        [P, 196],
      ],
      [
        [P, 228],
        [P, 239],
      ],
      [
        [P + 15, 254],
        [P2 - 135, 254],
      ],
      [
        [P2, 270],
        [P2, 288],
      ],
      [
        [P2, 330],
        [P2, 349],
      ],
      [
        [P, 269],
        [P, 290],
      ],
      [
        [P, 330],
        [P, 350],
      ],
      [
        [P, 382],
        [P, 402],
      ],
      [
        [P, 434],
        [P, 456],
      ],
      [
        [P, 486],
        [P, 506],
      ],
      {
        pts: [
          [P + 125, 418],
          [P2 - 115, 418],
        ],
        faded: true,
      },
    ];
    page('fig5', body, e);
  }

  // ───────── Figure 6: image analysis and priority ─────────
  {
    const Pc = 124,
      A = 560,
      A2 = 790,
      Rr = 1070,
      R2 = 1250,
      Ad = 1497;
    const body = [
      lane(8, 232, 'Pipeline'),
      lane(248, 652, 'AI vision (Rekognition in R1, AI module from R2)', true),
      lane(908, 422, 'Rule engine'),
      lane(1338, 318, 'Administrator'),
      init('i0', Pc, 60),
      act('q1', Pc, 82, 210, 56, 'Receive report images (1–5) and the citizen category'),
      act('q2', Pc, 527, 210, 42, 'Continue the report workflow (Figure 5)'),
      fin('finp', Pc, 604),
      `<div class="region" style="left:300px;top:58px;width:580px;height:420px"><span>«iterative» for each image</span></div>`,
      `<div class="pin" id="pin-in" style="left:285px;top:104px"><i></i><i></i><i></i></div>`,
      `<div class="pin" id="pin-out" style="left:${A - 15}px;top:472px"><i></i><i></i><i></i></div>`,
      act(
        's1',
        A,
        82,
        320,
        42,
        'Assess image quality: blur, darkness, obstruction, off-subject, no waste',
        'ai',
      ),
      dia('dq', A, 148),
      q(A - 82, 140, 'Usable?'),
      act('s2', A2, 156, 160, 42, 'Record quality flag; lower confidence', 'ai'),
      act('s3', A, 184, 300, 32, 'Classify visible waste (ranked classes, confidence)', 'ai'),
      act('s4', A, 230, 300, 32, 'Detect recyclables (keep > 70 %; never hazardous)', 'ai'),
      act(
        's5',
        A,
        276,
        300,
        42,
        'Spot hazard cues: smoke or fire, medical waste, chemical containers, sharps',
        'ai',
      ),
      act('s6', A, 332, 300, 32, 'Estimate visible waste level (S, M, L, XL)', 'ai'),
      act('s7', A, 378, 300, 32, 'Estimate visual composition share (not mass)', 'ai'),
      dia('mq', A, 438),
      act(
        's8',
        A,
        500,
        300,
        42,
        'Aggregate: highest evidence wins; highest agreed level; composition merged by area',
        'ai',
      ),
      dia('df', A, 574),
      q(A - 270, 566, 'Analysis failed, or confidence < 60 %?'),
      act('s9', A2, 590, 170, 42, 'Category default priority; review flag; retry later', 'ai'),
      dia('mf', A, 650),
      obj('o1', Rr, 46, 170, 30, 'Analysis result'),
      act(
        'r1',
        Rr,
        90,
        300,
        42,
        'Apply rules: AI evidence plus category, duplicates, age, zone, critical places',
      ),
      dia('dh1', Rr, 160),
      q(Rr - 140, 152, 'Hazard cue ≥ 70 %?'),
      act('r2', Rr, 190, 170, 32, 'Set Urgent or High'),
      dia('dh2', R2, 160),
      q(R2 - 24, 128, 'Cue ≥ 40 %?'),
      act('r3', R2, 190, 130, 32, 'Flag for review'),
      dia('mh', Rr, 262),
      dia('dc', Rr, 306),
      q(Rr - 156, 298, 'Category ≠ AI class?'),
      act('r4', R2, 290, 130, 32, 'Flag for review'),
      dia('mc', Rr, 352),
      act('r5', Rr, 378, 300, 32, 'Assign final priority: Urgent, High, Medium or Low'),
      obj(
        'o2',
        Rr,
        428,
        270,
        62,
        'Structured result',
        'priority, confidence, model version, labels, recyclables, level, composition, review flag',
      ),
      dia('dr', Rr, 524),
      q(Rr - 106, 516, 'Review flag?'),
      dia('mr', Rr, 600),
      act('r6', Rr, 632, 240, 32, 'Return the result to the pipeline'),
      act('ad1', Ad, 508, 230, 32, 'Review the flagged result'),
      dia('da', Ad, 570),
      q(Ad + 20, 548, 'Change needed?'),
      act('ad2', Ad, 608, 230, 42, 'Record a correction (kept as a separate override)'),
      g(A + 8, 166, 'yes'),
      g(A + 22, 128, 'no'),
      g(A + 8, 590, 'no'),
      g(A + 22, 554, 'yes'),
      g(Rr + 8, 174, 'yes'),
      g(Rr + 22, 140, 'no'),
      g(R2 - 44, 176, 'yes'),
      g(R2 + 18, 140, 'no'),
      g(Rr + 22, 286, 'yes'),
      g(Rr + 8, 322, 'no'),
      g(Rr + 22, 504, 'set'),
      g(Rr + 8, 542, 'not set'),
      g(Ad + 8, 586, 'yes'),
      g(Ad - 72, 548, 'no'),
    ].join('\n');
    const e = [
      [
        [Pc, 70],
        [Pc, 82],
      ],
      [
        [Pc + 105, 110],
        [285, 110],
      ],
      [
        [315, 110],
        [A - 160, 110],
      ],
      [
        [A, 124],
        [A, 133],
      ],
      [
        [A + 15, 148],
        [A2, 148],
        [A2, 156],
      ],
      [
        [A, 163],
        [A, 184],
      ],
      [
        [A, 216],
        [A, 230],
      ],
      [
        [A, 262],
        [A, 276],
      ],
      [
        [A, 318],
        [A, 332],
      ],
      [
        [A, 364],
        [A, 378],
      ],
      [
        [A, 410],
        [A, 423],
      ],
      [
        [A2, 198],
        [A2, 438],
        [A + 15, 438],
      ],
      [
        [A, 453],
        [A, 472],
      ],
      [
        [A, 484],
        [A, 500],
      ],
      [
        [A, 542],
        [A, 559],
      ],
      [
        [A + 15, 574],
        [A2, 574],
        [A2, 590],
      ],
      [
        [A, 589],
        [A, 635],
      ],
      [
        [A2, 632],
        [A2, 650],
        [A + 15, 650],
      ],
      [
        [A, 665],
        [A, 684],
        [918, 684],
        [918, 61],
        [Rr - 85, 61],
      ],
      [
        [Rr, 76],
        [Rr, 90],
      ],
      [
        [Rr, 132],
        [Rr, 145],
      ],
      [
        [Rr, 175],
        [Rr, 190],
      ],
      [
        [Rr, 222],
        [Rr, 247],
      ],
      [
        [Rr + 15, 160],
        [R2 - 15, 160],
      ],
      [
        [R2, 175],
        [R2, 190],
      ],
      [
        [R2, 222],
        [R2, 262],
        [Rr + 15, 262],
      ],
      {
        pts: [
          [R2 + 15, 160],
          [1312, 160],
          [1312, 262],
          [R2, 262],
        ],
        head: false,
      },
      [
        [Rr, 277],
        [Rr, 291],
      ],
      [
        [Rr + 15, 306],
        [R2 - 65, 306],
      ],
      [
        [R2, 322],
        [R2, 352],
        [Rr + 15, 352],
      ],
      [
        [Rr, 321],
        [Rr, 337],
      ],
      [
        [Rr, 367],
        [Rr, 378],
      ],
      [
        [Rr, 410],
        [Rr, 428],
      ],
      [
        [Rr, 490],
        [Rr, 509],
      ],
      [
        [Rr + 15, 524],
        [Ad - 115, 524],
      ],
      [
        [Rr, 539],
        [Rr, 585],
      ],
      [
        [Ad, 540],
        [Ad, 555],
      ],
      [
        [Ad, 585],
        [Ad, 608],
      ],
      [
        [Ad - 15, 570],
        [1160, 570],
        [1160, 600],
        [Rr + 15, 600],
      ],
      {
        pts: [
          [Ad - 115, 629],
          [1160, 629],
          [1160, 600],
        ],
        head: false,
      },
      [
        [Rr, 615],
        [Rr, 632],
      ],
      [
        [Rr - 120, 648],
        [934, 648],
        [934, 548],
        [Pc + 105, 548],
      ],
      [
        [Pc, 569],
        [Pc, 592],
      ],
    ];
    page('fig6', body, e);
  }
};
