(function(global){
  'use strict';
  const WORLDS=[
 {id:'A1',name:'وادي البدايات',de:'Das Tal der Anfänge',desc:'الكلمات اليومية الأولى',monster:'👹',color:'#7c3aed',words:`🍎|Apfel,🍌|Banane,🍊|Orange,🍋|Zitrone,🍓|Erdbeere,🍇|Traube,🍉|Wassermelone,🍐|Birne,🍒|Kirsche,🥝|Kiwi,🍞|Brot,🧀|Käse,🥚|Ei,🥛|Milch,💧|Wasser,☕|Kaffee,🍵|Tee,🍚|Reis,🍝|Nudeln,🥔|Kartoffel,🏠|Haus,🚪|Tür,🪟|Fenster,🛏️|Bett,🪑|Stuhl,🛋️|Sofa,🪞|Spiegel,💡|Lampe,🔑|Schlüssel,⏰|Uhr,🐶|Hund,🐱|Katze,🐭|Maus,🐰|Hase,🐴|Pferd,🐄|Kuh,🐷|Schwein,🐔|Huhn,🐦|Vogel,🐟|Fisch,👨|Mann,👩|Frau,👶|Baby,👦|Junge,👧|Mädchen,👨‍👩‍👧|Familie,👩‍🦰|Mutter,👨‍🦱|Vater,👦|Bruder,👧|Schwester,🚗|Auto,🚌|Bus,🚲|Fahrrad,🚆|Zug,✈️|Flugzeug,🚢|Schiff,🛣️|Straße,🏫|Schule,🏥|Krankenhaus,🏪|Geschäft,🏦|Bank,☀️|Sonne,🌙|Mond,⭐|Stern,☁️|Wolke,🌧️|Regen,❄️|Schnee,🌳|Baum,🌸|Blume,🌱|Pflanze,🔥|Feuer,👕|Hemd,👖|Hose,👗|Kleid,👟|Schuh,🧥|Jacke,🎩|Hut,🧦|Socke,👜|Tasche,📕|Buch,✏️|Bleistift,🖊️|Kugelschreiber,📄|Papier,📱|Handy,💻|Computer,📺|Fernseher,⚽|Ball,🎁|Geschenk,❤️|Herz,✋|Hand,🦶|Fuß,👁️|Auge,👂|Ohr,👃|Nase,👄|Mund,🦷|Zahn,💇|Haar,🙂|Gesicht,🔴|rot,🔵|blau,🟢|grün,🟡|gelb,⚫|schwarz`.split(',')},
 {id:'A2',name:'غابة الحياة',de:'Der Wald des Lebens',desc:'المواقف والأفعال اليومية',monster:'🐺',color:'#168b65',words:`🍳|kochen,🏃|laufen,😴|schlafen,📖|lesen,✍️|schreiben,🗣️|sprechen,👂|hören,👀|sehen,🍽️|essen,🥤|trinken,🏊|schwimmen,💃|tanzen,🎤|singen,🎮|spielen,🧹|putzen,🛒|einkaufen,🧑‍🏫|lernen,👨‍🏫|unterrichten,🚙|fahren,✈️|fliegen,🧑‍⚕️|Arzt,👩‍🏫|Lehrerin,👨‍🍳|Koch,👮|Polizist,👨‍🚒|Feuerwehrmann,🔧|Mechaniker,💇|Friseur,🌾|Bauer,💼|Verkäufer,🧑‍💻|Programmierer,🍴|Restaurant,🏨|Hotel,🚉|Bahnhof,✈️|Flughafen,📮|Post,💊|Apotheke,🏛️|Museum,🎭|Theater,🎬|Kino,📚|Bibliothek,🌅|Morgen,🌞|Mittag,🌇|Abend,🌙|Nacht,📅|Woche,🗓️|Monat,🎆|Jahr,⏳|Stunde,⏱️|Minute,🌷|Frühling,🏖️|Sommer,🍂|Herbst,☃️|Winter,🌡️|warm,🧊|kalt,📏|lang,🤏|kurz,🐘|groß,🐜|klein,🚀|schnell,🐢|langsam,😊|glücklich,😢|traurig,😠|wütend,😨|ängstlich,😫|müde,🤒|krank,💪|gesund,💰|teuer,🏷️|billig,🧼|sauber,🗑️|schmutzig,📭|leer,🧺|voll,🔊|laut,🤫|leise,⬆️|oben,⬇️|unten,⬅️|links,➡️|rechts,📍|Mitte,▶️|Anfang,⏹️|Ende,🎂|Geburtstag,💍|Hochzeit,🎉|Party,🏝️|Urlaub,🧳|Reise,🧾|Rechnung,💵|Geld,💳|Karte,🎟️|Fahrkarte,🛂|Pass,☂️|Regenschirm,👓|Brille,⌚|Armbanduhr,📷|Kamera,🧴|Flasche,🥄|Löffel,🔪|Messer,🍽️|Teller,🥤|Glas,🛁|Badezimmer`.split(',')},
 {id:'B1',name:'مدينة التحدي',de:'Die Stadt der Prüfung',desc:'مفردات الدراسة والعمل والمجتمع',monster:'🤖',color:'#d97706',words:`🎓|Ausbildung,💼|Beruf,🏢|Firma,👥|Kollege,👔|Chef,📝|Bewerbung,📄|Lebenslauf,🤝|Vorstellungsgespräch,💶|Gehalt,🏖️|Feierabend,🧑‍💼|Arbeitgeber,👷|Arbeitnehmer,📆|Termin,📋|Aufgabe,📈|Erfahrung,🛠️|Fähigkeit,✅|Erfolg,❌|Fehler,🎯|Ziel,🧠|Entscheidung,🌍|Umwelt,♻️|Recycling,🗑️|Müll,⚡|Energie,🌬️|Klima,🏭|Verschmutzung,🌲|Naturschutz,🚦|Verkehr,🚧|Stau,🚌|Nahverkehr,🚶|Fußgänger,🚴|Radfahrer,🏘️|Nachbarschaft,🏙️|Großstadt,🏡|Dorf,🏠|Wohnung,🧾|Miete,🧱|Gebäude,🌳|Garten,🪴|Balkon,🩺|Untersuchung,🤕|Verletzung,💊|Medikament,🏥|Behandlung,🦠|Krankheit,💉|Impfung,🥗|Ernährung,🏋️|Bewegung,🧘|Entspannung,📱|Nachricht,📰|Zeitung,📻|Radio,📺|Sendung,🌐|Internet,📢|Werbung,🔐|Datenschutz,📞|Anruf,✉️|Brief,📧|E-Mail,💬|Gespräch,❓|Frage,💡|Antwort,🗣️|Meinung,🤔|Gedanke,📚|Wissen,📖|Geschichte,🎨|Kunst,🎵|Musik,⚽|Sport,🎭|Kultur,🕌|Religion,⚖️|Gesetz,🕊️|Frieden,⚔️|Krieg,🗳️|Wahl,🏛️|Regierung,👨‍👩‍👧‍👦|Gesellschaft,🤲|Hilfe,🎗️|Unterstützung,🧑‍🤝‍🧑|Freundschaft,❤️|Liebe,💔|Trennung,🤬|Streit,🤝|Vertrauen,🧭|Verantwortung,🕰️|Vergangenheit,⏰|Gegenwart,🔮|Zukunft,📌|Grund,📉|Folge,🔀|Unterschied,🧩|Zusammenhang,🔁|Veränderung,📊|Entwicklung,📦|Möglichkeit,⚠️|Gefahr,🛡️|Sicherheit,🆘|Notfall,💥|Unfall,🔧|Reparatur,🔌|Technik,🔬|Forschung,🧪|Experiment`.split(',')},
 {id:'B2',name:'حصن المعرفة',de:'Die Festung des Wissens',desc:'الأفكار المعقدة والنقاش',monster:'🐉',color:'#2563eb',words:`📊|Wirtschaft,🏭|Industrie,🛍️|Verbraucher,📦|Produktion,💹|Investition,💸|Schulden,🏦|Finanzierung,🧾|Steuer,📉|Arbeitslosigkeit,📈|Wachstum,🌐|Globalisierung,🤖|Digitalisierung,💡|Innovation,🔧|Automatisierung,🧠|künstliche Intelligenz,🔋|Nachhaltigkeit,🌿|Ressource,🌡️|Erderwärmung,🌪️|Naturkatastrophe,🦋|Artenvielfalt,🏛️|Demokratie,🗽|Freiheit,⚖️|Gerechtigkeit,🤝|Gleichberechtigung,🚫|Diskriminierung,🌍|Migration,🧳|Integration,🛂|Flüchtling,🏠|Herkunft,🪪|Identität,🎓|Bildungssystem,🏫|Hochschule,🔬|Wissenschaft,📑|Studie,🧪|Methode,📐|Theorie,✅|Beweis,📊|Statistik,🔎|Analyse,📰|Berichterstattung,🗞️|Pressefreiheit,💻|soziale Medien,📣|Öffentlichkeit,⭐|Einfluss,🎭|Darstellung,🧭|Orientierung,🧠|Wahrnehmung,❤️|Beziehung,👪|Erziehung,🧒|Kindheit,🧑|Jugend,👴|Alter,🧬|Generation,⚖️|Konflikt,🫱🏽‍🫲🏻|Kompromiss,💬|Diskussion,🎙️|Debatte,📣|Argument,❗|Behauptung,🧐|Kritik,📝|Bewertung,📌|Standpunkt,🔭|Perspektive,🎯|Absicht,💭|Erwartung,😞|Enttäuschung,🏆|Leistung,🔥|Motivation,🧗|Herausforderung,🚧|Hindernis,🔓|Lösung,📋|Maßnahme,📜|Vorschrift,🚫|Verbot,✅|Erlaubnis,📜|Vertrag,🛡️|Versicherung,⚖️|Anspruch,🧑‍⚖️|Pflicht,📣|Forderung,🤲|Angebot,📦|Nachfrage,🧑‍💼|Dienstleistung,⭐|Qualität,⚙️|Effizienz,⏳|Aufwand,💰|Gewinn,📉|Verlust,🎲|Risiko,🧱|Voraussetzung,🔍|Ursache,🔗|Auswirkung,🎯|Bedeutung,🧾|Ergebnis,📏|Umfang,📊|Anteil,📐|Durchschnitt,🔝|Mehrheit,🔻|Minderheit`.split(',')},
 {id:'C1',name:'برج الكلمات',de:'Der Turm der Wörter',desc:'الدقة والتعبير المتقدم',monster:'🧙',color:'#be185d',words:`🧠|Erkenntnis,👁️|Bewusstsein,🪞|Selbstreflexion,💭|Vorstellungskraft,🧩|Denkweise,🧭|Überzeugung,📏|Wertvorstellung,🗿|Haltung,🎯|Priorität,⚖️|Abwägung,🔎|Betrachtung,📝|Erörterung,💬|Auseinandersetzung,🔗|Wechselwirkung,🌀|Phänomen,🧱|Struktur,🕸️|Komplexität,🧭|Orientierungslosigkeit,🌫️|Ungewissheit,🔀|Widerspruch,🌓|Ambivalenz,🫥|Entfremdung,🔄|Wandel,🏗️|Fortschritt,📉|Rückgang,🕳️|Mangel,🧨|Krise,🌋|Umbruch,📈|Aufschwung,🧱|Beständigkeit,🌊|Dynamik,🧬|Vielfalt,🧑‍🤝‍🧑|Zusammenhalt,🪜|Hierarchie,👑|Machtverhältnis,🏛️|Institution,🗂️|Verwaltung,⚙️|Bürokratie,📜|Gesetzgebung,⚖️|Rechtsprechung,🏛️|Verfassung,🌍|Souveränität,🤝|Zusammenarbeit,🕊️|Vermittlung,🗨️|Verhandlung,🛑|Widerstand,✊|Protest,🎗️|Engagement,🫡|Einsatzbereitschaft,🧑‍⚖️|Rechenschaft,🔐|Vertraulichkeit,🪟|Transparenz,✅|Glaubwürdigkeit,🎯|Zuverlässigkeit,🧱|Belastbarkeit,🔄|Anpassungsfähigkeit,💡|Kreativität,🛠️|Fachkompetenz,🗣️|Ausdrucksfähigkeit,👂|Einfühlungsvermögen,🧭|Urteilsvermögen,🚀|Eigeninitiative,🗓️|Zeitmanagement,📋|Vorgehensweise,🧰|Umsetzung,🔄|Überarbeitung,🧪|Auswertung,🧾|Befund,📚|Fachliteratur,🧷|Quelle,📎|Beleg,🧮|Datenerhebung,🧑‍🔬|Forschungsansatz,🔬|Untersuchungsgegenstand,📝|Fragestellung,💡|Hypothese,🧾|Schlussfolgerung,🔮|Prognose,🎯|Zielsetzung,📦|Rahmenbedingung,🚧|Einschränkung,🪢|Abhängigkeit,🔗|Übereinstimmung,↔️|Abweichung,📊|Verhältnismäßigkeit,⚖️|Angemessenheit,🧭|Nachvollziehbarkeit,✅|Machbarkeit,🌱|Zukunftsfähigkeit,🛡️|Vorsorge,🤲|Fürsorge,🫂|Solidarität,🧑‍🤝‍🧑|Teilhabe,🚪|Zugänglichkeit,♿|Barrierefreiheit,🌐|Vernetzung,📡|Informationsfluss`.split(',')}
];

// Complete the final vocabulary sets to exactly 100 playable cards per world.
WORLDS[3].words.push('🧭|Tendenz');
WORLDS[4].words.push('🧩|Sachverhalt','🗣️|Stellungnahme','📌|Schwerpunkt');
WORLDS.forEach(w=>w.words=w.words.slice(0,100));

  const WORD_ART={Apfel:'apple',Banane:'banana',Orange:'orange',Zitrone:'lemon',Erdbeere:'strawberry',Traube:'grapes',Wassermelone:'watermelon',Birne:'pear',Kirsche:'cherries',Kiwi:'kiwi'};
  const MONSTERS=[{name:'وحش البلور',className:'variant-crystal'},{name:'خنزير الجليد',className:'variant-boar'},{name:'تانوكي العاصفة',className:'variant-tanuki'}];
  const SENTENCE_PLACES=[
    {id:'home',name:'المنزل',de:'Zu Hause',npc:'لومي',npcRole:'رفيقة المنزل',npcClass:'npc-home',sceneClass:'sentence-home',accent:'#20cdb5',sentences:[
      {ar:'قل صباح الخير',de:'Guten Morgen!',reply:'Guten Morgen, Le!'},
      {ar:'قل: أنا في المنزل الآن',de:'Ich bin jetzt zu Hause.',reply:'Schön, dass du da bist.'},
      {ar:'اطلب منها إغلاق الباب',de:'Kannst du bitte die Tür schließen?',reply:'Ja, natürlich.'},
      {ar:'اسأل عن مفتاحك',de:'Wo ist mein Schlüssel?',reply:'Er liegt auf dem Tisch.'},
      {ar:'قل إنك ستفتح النافذة',de:'Ich mache das Fenster auf.',reply:'Dann kommt frische Luft herein.'},
      {ar:'قل إن الطعام جاهز',de:'Das Essen ist fertig.',reply:'Super, ich komme gleich.'},
      {ar:'قل إنك ترتب غرفتك',de:'Ich räume mein Zimmer auf.',reply:'Das ist eine gute Idee.'},
      {ar:'اطلب المساعدة بأدب',de:'Kannst du mir bitte helfen?',reply:'Gern, was soll ich machen?'},
      {ar:'قل إنك تحضّر الفطور',de:'Ich bereite das Frühstück vor.',reply:'Ich decke den Tisch.'},
      {ar:'ودّعها قبل النوم',de:'Gute Nacht, bis morgen.',reply:'Schlaf gut, Le!'}
    ]},
    {id:'work',name:'العمل',de:'Bei der Arbeit',npc:'فريتز',npcRole:'مدير المكتب',npcClass:'npc-work',sceneClass:'sentence-work',accent:'#1787e8',sentences:[
      {ar:'حيِّ مديرك وقل إنك وصلت في الوقت',de:'Guten Morgen, ich bin heute pünktlich.',reply:'Guten Morgen, sehr gut.'},
      {ar:'اسأل عن مهمتك اليوم',de:'Was soll ich heute machen?',reply:'Bitte bearbeiten Sie diese Aufgabe.'},
      {ar:'قل إنك تعمل على هذه المهمة',de:'Ich arbeite gerade an dieser Aufgabe.',reply:'Nehmen Sie sich genug Zeit.'},
      {ar:'اطلب منه أن يشرح لك',de:'Können Sie mir das bitte erklären?',reply:'Ja, ich zeige es Ihnen.'},
      {ar:'قل إنك تحتاج إلى وقت إضافي',de:'Ich brauche etwas mehr Zeit.',reply:'Kein Problem.'},
      {ar:'اسأل متى يبدأ الاجتماع',de:'Wann beginnt die Besprechung?',reply:'Die Besprechung beginnt um zehn Uhr.'},
      {ar:'قل إنك سترسل البريد الإلكتروني',de:'Ich schicke Ihnen die E-Mail.',reply:'Vielen Dank.'},
      {ar:'اطلب استراحة قصيرة',de:'Können wir eine kurze Pause machen?',reply:'Ja, für zehn Minuten.'},
      {ar:'أخبره أن المهمة انتهت',de:'Die Aufgabe ist jetzt fertig.',reply:'Sehr gute Arbeit.'},
      {ar:'اشكره على مساعدته',de:'Vielen Dank für Ihre Hilfe.',reply:'Sehr gern, Le.'}
    ]},
    {id:'market',name:'السوبرماركت',de:'Im Supermarkt',npc:'ميرو',npcRole:'موظف المتجر',npcClass:'npc-market',sceneClass:'sentence-market',accent:'#f57a1f',sentences:[
      {ar:'حيِّ الموظف وقل إنك تريد التسوق',de:'Guten Tag, ich möchte etwas einkaufen.',reply:'Guten Tag, gern.'},
      {ar:'اسأل أين تجد الحليب',de:'Wo finde ich die Milch?',reply:'Die Milch ist dort rechts.'},
      {ar:'اسأل إن كان لديهم خبز طازج',de:'Haben Sie frisches Brot?',reply:'Ja, das Brot ist noch warm.'},
      {ar:'اسأل عن السعر',de:'Wie viel kostet das?',reply:'Das kostet drei Euro.'},
      {ar:'اطلب كيلوغرامًا من التفاح',de:'Ich brauche ein Kilo Äpfel.',reply:'Natürlich, hier bitte.'},
      {ar:'اسأل إن كان هناك خيار أرخص',de:'Gibt es das auch günstiger?',reply:'Ja, dieses Produkt ist günstiger.'},
      {ar:'اسأل إن كان يمكنك الدفع بالبطاقة',de:'Kann ich mit Karte bezahlen?',reply:'Ja, das ist möglich.'},
      {ar:'اطلب كيسًا بأدب',de:'Ich hätte gern eine Tüte, bitte.',reply:'Hier ist Ihre Tüte.'},
      {ar:'اسأل أين صندوق الدفع',de:'Wo ist die Kasse?',reply:'Die Kasse ist am Ausgang.'},
      {ar:'اشكره وودّعه',de:'Vielen Dank, auf Wiedersehen.',reply:'Auf Wiedersehen, Le!'}
    ]}
  ];
  const HEROES=[
    {id:'le-frog',name:'Le الضفدع',price:0,states:['idle','run','attack-1','attack-2','damage','victory']},
    {id:'le-shadow',name:'Le الظل',price:1200,comingSoon:true},
    {id:'le-ronin',name:'Le الرونين',price:2400,comingSoon:true}
  ];
  const SHOP=Object.freeze({currency:'شظايا الكلمات',heroes:HEROES});
  global.LegramContent=Object.freeze({WORLDS,WORD_ART,MONSTERS,HEROES,SHOP,SENTENCE_PLACES});
})(window);
