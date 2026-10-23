/* Legram — lexicon: grammatical article and Arabic meaning for every word.
 * Format: word: 'article|meaning'. Article is der, die, das, die-pl (plural
 * noun) or empty for verbs, adjectives and adverbs.
 */
(function (global) {
  'use strict';
  const RAW = {
    // A1
    Apfel:'der|تفاحة', Banane:'die|موزة', Orange:'die|برتقالة', Zitrone:'die|ليمونة', Erdbeere:'die|فراولة', Traube:'die|عنب', Wassermelone:'die|بطيخة', Birne:'die|كمثرى', Kirsche:'die|كرزة', Kiwi:'die|كيوي',
    Brot:'das|خبز', Käse:'der|جبن', Ei:'das|بيضة', Milch:'die|حليب', Wasser:'das|ماء', Kaffee:'der|قهوة', Tee:'der|شاي', Reis:'der|أرز', Nudeln:'die-pl|معكرونة', Kartoffel:'die|بطاطس',
    Haus:'das|بيت', Tür:'die|باب', Fenster:'das|نافذة', Bett:'das|سرير', Stuhl:'der|كرسي', Sofa:'das|أريكة', Spiegel:'der|مرآة', Lampe:'die|مصباح', Schlüssel:'der|مفتاح', Uhr:'die|ساعة',
    Hund:'der|كلب', Katze:'die|قطة', Maus:'die|فأر', Hase:'der|أرنب', Pferd:'das|حصان', Kuh:'die|بقرة', Schwein:'das|خنزير', Huhn:'das|دجاجة', Vogel:'der|طائر', Fisch:'der|سمكة',
    Mann:'der|رجل', Frau:'die|امرأة', Baby:'das|رضيع', Junge:'der|ولد', Mädchen:'das|بنت', Familie:'die|عائلة', Mutter:'die|أم', Vater:'der|أب', Bruder:'der|أخ', Schwester:'die|أخت',
    Auto:'das|سيارة', Bus:'der|حافلة', Fahrrad:'das|دراجة', Zug:'der|قطار', Flugzeug:'das|طائرة', Schiff:'das|سفينة', Straße:'die|شارع', Schule:'die|مدرسة', Krankenhaus:'das|مستشفى', Geschäft:'das|متجر',
    Bank:'die|بنك', Sonne:'die|شمس', Mond:'der|قمر', Stern:'der|نجمة', Wolke:'die|غيمة', Regen:'der|مطر', Schnee:'der|ثلج', Baum:'der|شجرة', Blume:'die|زهرة', Pflanze:'die|نبتة',
    Feuer:'das|نار', Hemd:'das|قميص', Hose:'die|بنطال', Kleid:'das|فستان', Schuh:'der|حذاء', Jacke:'die|سترة', Hut:'der|قبعة', Socke:'die|جورب', Tasche:'die|حقيبة', Buch:'das|كتاب',
    Bleistift:'der|قلم رصاص', Kugelschreiber:'der|قلم حبر', Papier:'das|ورق', Handy:'das|هاتف محمول', Computer:'der|حاسوب', Fernseher:'der|تلفاز', Ball:'der|كرة', Geschenk:'das|هدية', Herz:'das|قلب', Hand:'die|يد',
    Fuß:'der|قدم', Auge:'das|عين', Ohr:'das|أذن', Nase:'die|أنف', Mund:'der|فم', Zahn:'der|سن', Haar:'das|شعر', Gesicht:'das|وجه', rot:'|أحمر', blau:'|أزرق', grün:'|أخضر', gelb:'|أصفر', schwarz:'|أسود',
    // A2
    kochen:'|يطبخ', laufen:'|يركض', schlafen:'|ينام', lesen:'|يقرأ', schreiben:'|يكتب', sprechen:'|يتكلم', hören:'|يسمع', sehen:'|يرى', essen:'|يأكل', trinken:'|يشرب',
    schwimmen:'|يسبح', tanzen:'|يرقص', singen:'|يغني', spielen:'|يلعب', putzen:'|ينظف', einkaufen:'|يتسوق', lernen:'|يتعلم', unterrichten:'|يُدرِّس', fahren:'|يقود', fliegen:'|يطير',
    Arzt:'der|طبيب', Lehrerin:'die|معلمة', Koch:'der|طباخ', Polizist:'der|شرطي', Feuerwehrmann:'der|رجل إطفاء', Mechaniker:'der|ميكانيكي', Friseur:'der|حلاق', Bauer:'der|مزارع', Verkäufer:'der|بائع', Programmierer:'der|مبرمج',
    Restaurant:'das|مطعم', Hotel:'das|فندق', Bahnhof:'der|محطة القطار', Flughafen:'der|مطار', Post:'die|مكتب البريد', Apotheke:'die|صيدلية', Museum:'das|متحف', Theater:'das|مسرح', Kino:'das|سينما', Bibliothek:'die|مكتبة عامة',
    Morgen:'der|صباح', Mittag:'der|ظهيرة', Abend:'der|مساء', Nacht:'die|ليل', Woche:'die|أسبوع', Monat:'der|شهر', Jahr:'das|سنة', Stunde:'die|ساعة (مدة)', Minute:'die|دقيقة', Frühling:'der|ربيع',
    Sommer:'der|صيف', Herbst:'der|خريف', Winter:'der|شتاء', warm:'|دافئ', kalt:'|بارد', lang:'|طويل', kurz:'|قصير', groß:'|كبير', klein:'|صغير', schnell:'|سريع',
    langsam:'|بطيء', glücklich:'|سعيد', traurig:'|حزين', wütend:'|غاضب', ängstlich:'|خائف', müde:'|متعب', krank:'|مريض', gesund:'|بصحة جيدة', teuer:'|غالٍ', billig:'|رخيص',
    sauber:'|نظيف', schmutzig:'|متسخ', leer:'|فارغ', voll:'|ممتلئ', laut:'|صاخب', leise:'|هادئ', oben:'|فوق', unten:'|تحت', links:'|يسار', rechts:'|يمين',
    Mitte:'die|وسط', Anfang:'der|بداية', Ende:'das|نهاية', Geburtstag:'der|عيد ميلاد', Hochzeit:'die|حفل زفاف', Party:'die|حفلة', Urlaub:'der|إجازة', Reise:'die|رحلة', Rechnung:'die|فاتورة', Geld:'das|مال',
    Karte:'die|بطاقة', Fahrkarte:'die|تذكرة سفر', Pass:'der|جواز سفر', Regenschirm:'der|مظلة مطر', Brille:'die|نظارة', Armbanduhr:'die|ساعة يد', Kamera:'die|كاميرا', Flasche:'die|زجاجة', Löffel:'der|ملعقة', Messer:'das|سكين',
    // B1
    Ausbildung:'die|تدريب مهني', Beruf:'der|مهنة', Firma:'die|شركة', Kollege:'der|زميل', Chef:'der|مدير', Bewerbung:'die|طلب توظيف', Lebenslauf:'der|سيرة ذاتية', Vorstellungsgespräch:'das|مقابلة عمل', Gehalt:'das|راتب', Feierabend:'der|نهاية الدوام',
    Arbeitgeber:'der|صاحب العمل', Arbeitnehmer:'der|موظف', Termin:'der|موعد', Aufgabe:'die|مهمة', Erfahrung:'die|خبرة', Fähigkeit:'die|قدرة', Erfolg:'der|نجاح', Fehler:'der|خطأ', Ziel:'das|هدف', Entscheidung:'die|قرار',
    Umwelt:'die|بيئة', Recycling:'das|إعادة تدوير', Müll:'der|قمامة', Energie:'die|طاقة', Klima:'das|مناخ', Verschmutzung:'die|تلوث', Naturschutz:'der|حماية الطبيعة', Verkehr:'der|حركة المرور', Stau:'der|ازدحام مروري', Nahverkehr:'der|النقل المحلي',
    Fußgänger:'der|ماشٍ على الأقدام', Radfahrer:'der|راكب دراجة', Nachbarschaft:'die|الحي', Großstadt:'die|مدينة كبيرة', Dorf:'das|قرية', Wohnung:'die|شقة', Miete:'die|إيجار', Gebäude:'das|مبنى', Garten:'der|حديقة', Balkon:'der|شرفة',
    Untersuchung:'die|فحص', Verletzung:'die|إصابة', Medikament:'das|دواء', Behandlung:'die|علاج', Krankheit:'die|مرض', Impfung:'die|تطعيم', Ernährung:'die|تغذية', Bewegung:'die|حركة', Entspannung:'die|استرخاء', Nachricht:'die|خبر / رسالة',
    Zeitung:'die|صحيفة', Radio:'das|راديو', Sendung:'die|برنامج تلفزيوني', Internet:'das|إنترنت', Werbung:'die|إعلان', Datenschutz:'der|حماية البيانات', Anruf:'der|مكالمة', Brief:'der|رسالة ورقية', 'E-Mail':'die|بريد إلكتروني', Gespräch:'das|محادثة',
    Frage:'die|سؤال', Antwort:'die|جواب', Meinung:'die|رأي', Gedanke:'der|فكرة', Wissen:'das|معرفة', Geschichte:'die|تاريخ / قصة', Kunst:'die|فن', Musik:'die|موسيقى', Sport:'der|رياضة', Kultur:'die|ثقافة',
    Religion:'die|دين', Gesetz:'das|قانون', Frieden:'der|سلام', Krieg:'der|حرب', Wahl:'die|انتخابات', Regierung:'die|حكومة', Gesellschaft:'die|مجتمع', Hilfe:'die|مساعدة', Unterstützung:'die|دعم', Freundschaft:'die|صداقة',
    Liebe:'die|حب', Trennung:'die|انفصال', Streit:'der|شجار', Vertrauen:'das|ثقة', Verantwortung:'die|مسؤولية', Vergangenheit:'die|الماضي', Gegenwart:'die|الحاضر', Zukunft:'die|المستقبل', Grund:'der|سبب', Folge:'die|عاقبة',
    Unterschied:'der|فرق', Zusammenhang:'der|ترابط', Veränderung:'die|تغيير', Entwicklung:'die|تطور', Möglichkeit:'die|إمكانية', Gefahr:'die|خطر', Sicherheit:'die|أمان', Notfall:'der|حالة طوارئ', Unfall:'der|حادث', Reparatur:'die|إصلاح',
    // B2
    Wirtschaft:'die|اقتصاد', Industrie:'die|صناعة', Verbraucher:'der|مستهلك', Produktion:'die|إنتاج', Investition:'die|استثمار', Schulden:'die-pl|ديون', Finanzierung:'die|تمويل', Steuer:'die|ضريبة', Arbeitslosigkeit:'die|بطالة', Wachstum:'das|نمو',
    Globalisierung:'die|عولمة', Digitalisierung:'die|رقمنة', Innovation:'die|ابتكار', Automatisierung:'die|أتمتة', 'künstliche Intelligenz':'die|ذكاء اصطناعي', Nachhaltigkeit:'die|استدامة', Ressource:'die|مورد', Erderwärmung:'die|الاحتباس الحراري', Naturkatastrophe:'die|كارثة طبيعية', Artenvielfalt:'die|التنوع الحيوي',
    Demokratie:'die|ديمقراطية', Freiheit:'die|حرية', Gerechtigkeit:'die|عدالة', Gleichberechtigung:'die|مساواة في الحقوق', Diskriminierung:'die|تمييز', Migration:'die|هجرة', Integration:'die|اندماج', Flüchtling:'der|لاجئ', Herkunft:'die|أصل', Identität:'die|هوية',
    Bildungssystem:'das|نظام تعليمي', Hochschule:'die|جامعة', Wissenschaft:'die|علم', Studie:'die|دراسة', Methode:'die|منهج', Theorie:'die|نظرية', Beweis:'der|دليل', Statistik:'die|إحصاء', Analyse:'die|تحليل', Berichterstattung:'die|تغطية إعلامية',
    Pressefreiheit:'die|حرية الصحافة', 'soziale Medien':'die-pl|وسائل التواصل', Öffentlichkeit:'die|الرأي العام', Einfluss:'der|تأثير', Darstellung:'die|تصوير / عرض', Orientierung:'die|توجّه', Wahrnehmung:'die|إدراك', Beziehung:'die|علاقة', Erziehung:'die|تربية', Kindheit:'die|طفولة',
    Jugend:'die|شباب', Alter:'das|عمر', Generation:'die|جيل', Konflikt:'der|نزاع', Kompromiss:'der|حل وسط', Diskussion:'die|نقاش', Debatte:'die|مناظرة', Argument:'das|حجة', Behauptung:'die|ادعاء', Kritik:'die|نقد',
    Bewertung:'die|تقييم', Standpunkt:'der|وجهة نظر', Perspektive:'die|منظور', Absicht:'die|نية', Erwartung:'die|توقع', Enttäuschung:'die|خيبة أمل', Leistung:'die|أداء', Motivation:'die|دافعية', Herausforderung:'die|تحدٍّ', Hindernis:'das|عائق',
    Lösung:'die|حل', Maßnahme:'die|إجراء', Vorschrift:'die|لائحة', Verbot:'das|حظر', Erlaubnis:'die|إذن', Vertrag:'der|عقد', Versicherung:'die|تأمين', Anspruch:'der|استحقاق', Pflicht:'die|واجب', Forderung:'die|مطلب',
    Angebot:'das|عرض', Nachfrage:'die|طلب (في السوق)', Dienstleistung:'die|خدمة', Qualität:'die|جودة', Effizienz:'die|كفاءة', Aufwand:'der|جهد مبذول', Gewinn:'der|ربح', Verlust:'der|خسارة', Risiko:'das|مخاطرة', Voraussetzung:'die|شرط مسبق',
    Ursache:'die|سبب', Auswirkung:'die|أثر', Bedeutung:'die|أهمية / معنى', Ergebnis:'das|نتيجة', Umfang:'der|نطاق', Anteil:'der|حصة', Durchschnitt:'der|متوسط', Mehrheit:'die|أغلبية', Minderheit:'die|أقلية', Tendenz:'die|اتجاه',
    // C1
    Erkenntnis:'die|إدراك', Bewusstsein:'das|وعي', Selbstreflexion:'die|التأمل الذاتي', Vorstellungskraft:'die|الخيال', Denkweise:'die|طريقة التفكير', Überzeugung:'die|قناعة', Wertvorstellung:'die|منظومة القيم', Haltung:'die|موقف', Priorität:'die|أولوية', Abwägung:'die|موازنة',
    Betrachtung:'die|تأمل', Erörterung:'die|مناقشة مفصلة', Auseinandersetzung:'die|مواجهة فكرية', Wechselwirkung:'die|تأثير متبادل', Phänomen:'das|ظاهرة', Struktur:'die|بنية', Komplexität:'die|تعقيد', Orientierungslosigkeit:'die|التيه', Ungewissheit:'die|عدم اليقين', Widerspruch:'der|تناقض',
    Ambivalenz:'die|ازدواجية المشاعر', Entfremdung:'die|اغتراب', Wandel:'der|تحوّل', Fortschritt:'der|تقدم', Rückgang:'der|تراجع', Mangel:'der|نقص', Krise:'die|أزمة', Umbruch:'der|تحول جذري', Aufschwung:'der|انتعاش', Beständigkeit:'die|ثبات',
    Dynamik:'die|ديناميكية', Vielfalt:'die|تنوع', Zusammenhalt:'der|تماسك', Hierarchie:'die|تسلسل هرمي', Machtverhältnis:'das|ميزان القوى', Institution:'die|مؤسسة', Verwaltung:'die|إدارة', Bürokratie:'die|بيروقراطية', Gesetzgebung:'die|تشريع', Rechtsprechung:'die|القضاء',
    Verfassung:'die|دستور', Souveränität:'die|سيادة', Zusammenarbeit:'die|تعاون', Vermittlung:'die|وساطة', Verhandlung:'die|تفاوض', Widerstand:'der|مقاومة', Protest:'der|احتجاج', Engagement:'das|التزام', Einsatzbereitschaft:'die|الاستعداد للعمل', Rechenschaft:'die|مساءلة',
    Vertraulichkeit:'die|سرية', Transparenz:'die|شفافية', Glaubwürdigkeit:'die|مصداقية', Zuverlässigkeit:'die|موثوقية', Belastbarkeit:'die|قدرة التحمل', Anpassungsfähigkeit:'die|القدرة على التكيف', Kreativität:'die|إبداع', Fachkompetenz:'die|كفاءة تخصصية', Ausdrucksfähigkeit:'die|القدرة على التعبير', Einfühlungsvermögen:'das|التعاطف',
    Urteilsvermögen:'das|حسن التقدير', Eigeninitiative:'die|المبادرة الذاتية', Zeitmanagement:'das|إدارة الوقت', Vorgehensweise:'die|أسلوب العمل', Umsetzung:'die|تنفيذ', Überarbeitung:'die|مراجعة', Auswertung:'die|تحليل النتائج', Befund:'der|نتيجة الفحص', Fachliteratur:'die|المراجع المتخصصة', Quelle:'die|مصدر',
    Beleg:'der|إثبات', Datenerhebung:'die|جمع البيانات', Forschungsansatz:'der|منهج البحث', Untersuchungsgegenstand:'der|موضوع الدراسة', Fragestellung:'die|إشكالية البحث', Hypothese:'die|فرضية', Schlussfolgerung:'die|استنتاج', Prognose:'die|تنبؤ', Zielsetzung:'die|تحديد الأهداف', Rahmenbedingung:'die|شرط إطاري',
    Einschränkung:'die|قيد', Abhängigkeit:'die|تبعية', Übereinstimmung:'die|تطابق', Abweichung:'die|انحراف', Verhältnismäßigkeit:'die|التناسب', Angemessenheit:'die|الملاءمة', Nachvollziehbarkeit:'die|قابلية التتبع', Machbarkeit:'die|الجدوى', Zukunftsfähigkeit:'die|الصمود مستقبلًا', Vorsorge:'die|الوقاية',
    Fürsorge:'die|الرعاية', Solidarität:'die|تضامن', Teilhabe:'die|المشاركة', Zugänglichkeit:'die|إمكانية الوصول', Barrierefreiheit:'die|الخلو من العوائق', Vernetzung:'die|الترابط الشبكي', Informationsfluss:'der|تدفق المعلومات', Sachverhalt:'der|الوقائع', Stellungnahme:'die|بيان موقف', Schwerpunkt:'der|محور التركيز'
  };

  const ARTICLES = ['der', 'die', 'das'];
  function entry(word) {
    const raw = RAW[word];
    if (!raw) return { word, article: '', plural: false, ar: '', display: word };
    const [art, ar] = raw.split('|');
    const plural = art === 'die-pl';
    const article = plural ? 'die' : art;
    return { word, article, plural, ar, display: article ? `${article} ${word}` : word };
  }

  global.LegramLexicon = Object.freeze({ entry, ARTICLES, size: Object.keys(RAW).length });
})(window);
