// Tournaments Expansion: All World Cups, European Championships, Champions League, Europa League, & African Cups (AFCON)
const TOURNAMENTS_WORDS = [
  // ==========================================================================
  // SECTION 1: ALL WORLD CUPS (1930 - 2022)
  // ==========================================================================
  {
    word: 'URUGUAY',
    category: 'World Cup Epics',
    clue: 'Inaugural host and champions of the very first FIFA World Cup in 1930 at the Centenario.',
    masked_pattern: 'U R _ G _ _ Y',
    missing_letters: 'U,U,A',
    distractors: 'O,E,I,S',
    year: '1930',
    team: 'Uruguay',
    difficulty: 2
  },
  {
    word: 'POZZO',
    category: 'World Cup Epics',
    clue: 'The only manager in football history to win two World Cups (1934 and 1938 with Italy).',
    masked_pattern: 'P _ Z Z _',
    missing_letters: 'O,O',
    distractors: 'A,E,I,U',
    year: '1938',
    team: 'Italy',
    difficulty: 2
  },
  {
    word: 'PIOLA',
    category: 'World Cup Epics',
    clue: 'Italian striker who scored twice in the 1938 World Cup final against Hungary in Paris.',
    masked_pattern: 'P _ _ L A',
    missing_letters: 'I,O',
    distractors: 'A,E,U,R',
    year: '1938',
    team: 'Italy',
    difficulty: 2
  },
  {
    word: 'WALTER',
    category: 'World Cup Epics',
    clue: 'Inspirational captain who led West Germany to the Miracle of Bern World Cup title in 1954.',
    masked_pattern: 'W _ L T _ R',
    missing_letters: 'A,E',
    distractors: 'O,I,U,K',
    year: '1954',
    team: 'West Germany',
    difficulty: 1
  },
  {
    word: 'DIDI',
    category: 'World Cup Epics',
    clue: 'Voted Best Player of the 1958 World Cup, the midfield genius who invented the dry leaf free-kick.',
    masked_pattern: 'D _ D _',
    missing_letters: 'I,I',
    distractors: 'A,E,O,U',
    year: '1958',
    team: 'Brazil',
    difficulty: 1
  },
  {
    word: 'AMARILDO',
    category: 'World Cup Epics',
    clue: 'Stepped in after Pelé was injured at the 1962 World Cup, scoring in the final against Czechoslovakia.',
    masked_pattern: 'A M _ R _ L D O',
    missing_letters: 'A,I',
    distractors: 'E,O,U,T',
    year: '1962',
    team: 'Brazil',
    difficulty: 2
  },
  {
    word: 'MOORE',
    category: 'World Cup Epics',
    clue: 'Immaculate England captain who hoisted the Jules Rimet trophy on home soil at Wembley in 1966.',
    masked_pattern: 'M _ _ R E',
    missing_letters: 'O,O',
    distractors: 'A,E,I,U',
    year: '1966',
    team: 'England',
    difficulty: 1
  },
  {
    word: 'BANKS',
    category: 'World Cup Epics',
    clue: 'England goalkeeper who pulled off the Save of the Century from Pelé\'s downward header in 1970.',
    masked_pattern: 'B _ N K _',
    missing_letters: 'A,S',
    distractors: 'E,O,I,T',
    year: '1970',
    team: 'England',
    difficulty: 1
  },
  {
    word: 'TOSTAO',
    category: 'World Cup Epics',
    clue: 'Brazilian false-nine doctor who overcame a detached retina to star in the magnificent 1970 team.',
    masked_pattern: 'T _ S T _ O',
    missing_letters: 'O,A',
    distractors: 'E,I,U,R',
    year: '1970',
    team: 'Brazil',
    difficulty: 2
  },
  {
    word: 'GERD MULLER',
    category: 'World Cup Epics',
    clue: 'Der Bomber, supreme German poacher who scored the winning goal in the 1974 World Cup final in Munich.',
    masked_pattern: 'G _ R D  M _ L L E R',
    missing_letters: 'E,U',
    distractors: 'A,O,I,K',
    year: '1974',
    team: 'West Germany',
    difficulty: 2
  },
  {
    word: 'PASSARELLA',
    category: 'World Cup Epics',
    clue: 'El Gran Capitan, tough Argentine defender who captained his nation to their maiden 1978 World Cup.',
    masked_pattern: 'P _ S S _ R E L L _',
    missing_letters: 'A,A,A',
    distractors: 'E,I,O,U',
    year: '1978',
    team: 'Argentina',
    difficulty: 2
  },
  {
    word: 'ROSSI',
    category: 'World Cup Epics',
    clue: 'Italian striker who netted a hat-trick against Brazil and was top scorer at the 1982 World Cup in Spain.',
    masked_pattern: 'R _ S S _',
    missing_letters: 'O,I',
    distractors: 'A,E,U,T',
    year: '1982',
    team: 'Italy',
    difficulty: 1
  },
  {
    word: 'ZOFF',
    category: 'World Cup Epics',
    clue: 'At 40 years of age, he became the oldest captain to ever lift the World Cup trophy in 1982.',
    masked_pattern: 'Z _ F _',
    missing_letters: 'O,F',
    distractors: 'A,E,I,T',
    year: '1982',
    team: 'Italy',
    difficulty: 1
  },
  {
    word: 'BURRUCHAGA',
    category: 'World Cup Epics',
    clue: 'Argentine midfielder who broke clear from Maradona\'s pass to slot home the 84th-minute 1986 final winner.',
    masked_pattern: 'B _ R R _ C H _ G A',
    missing_letters: 'U,U,A',
    distractors: 'E,I,O,T',
    year: '1986',
    team: 'Argentina',
    difficulty: 3
  },
  {
    word: 'BREHME',
    category: 'World Cup Epics',
    clue: 'Left-back who calmly slotted the 85th-minute penalty with his right foot to win the 1990 World Cup.',
    masked_pattern: 'B R _ H M _',
    missing_letters: 'E,E',
    distractors: 'A,I,O,U',
    year: '1990',
    team: 'West Germany',
    difficulty: 2
  },
  {
    word: 'BEBETO',
    category: 'World Cup Epics',
    clue: 'Brazilian forward who created the famous rock-the-baby goal celebration at the 1994 World Cup.',
    masked_pattern: 'B _ B _ T O',
    missing_letters: 'E,E',
    distractors: 'A,I,O,U',
    year: '1994',
    team: 'Brazil',
    difficulty: 1
  },
  {
    word: 'THURAM',
    category: 'World Cup Epics',
    clue: 'French defender who had never scored internationally, then struck twice in the 1998 semifinal vs Croatia.',
    masked_pattern: 'T H _ R _ M',
    missing_letters: 'U,A',
    distractors: 'E,I,O,S',
    year: '1998',
    team: 'France',
    difficulty: 2
  },
  {
    word: 'CAFU',
    category: 'World Cup Legends',
    clue: 'Tireless Brazilian right-back who played in three consecutive World Cup finals (1994, 1998, 2002).',
    masked_pattern: 'C _ F _',
    missing_letters: 'A,U',
    distractors: 'E,I,O,R',
    year: '2002',
    team: 'Brazil',
    difficulty: 1
  },
  {
    word: 'GROSSO',
    category: 'World Cup Epics',
    clue: 'Italian left-back who scored the 119th-minute curling semifinal goal vs Germany and the winning 2006 penalty.',
    masked_pattern: 'G R _ S S _',
    missing_letters: 'O,O',
    distractors: 'A,E,I,U',
    year: '2006',
    team: 'Italy',
    difficulty: 1
  },
  {
    word: 'DAVID VILLA',
    category: 'World Cup Epics',
    clue: 'El Guaje, Spain\'s all-time top scorer who scored 5 crucial goals in Spain\'s 2010 World Cup conquest.',
    masked_pattern: 'D _ V I D  V _ L L A',
    missing_letters: 'A,I',
    distractors: 'E,O,U,R',
    year: '2010',
    team: 'Spain',
    difficulty: 1
  },
  {
    word: 'GOTZE',
    category: 'World Cup Epics',
    clue: 'Chested and volleyed the 113th-minute extra-time winner for Germany against Argentina in the 2014 final.',
    masked_pattern: 'G _ T Z _',
    missing_letters: 'O,E',
    distractors: 'A,I,U,K',
    year: '2014',
    team: 'Germany',
    difficulty: 1
  },
  {
    word: 'GRIEZMANN',
    category: 'World Cup Epics',
    clue: 'Man of the Match in the 2018 World Cup final in Moscow, scoring a penalty and assisting Pogba.',
    masked_pattern: 'G R _ _ Z M A N N',
    missing_letters: 'I,E',
    distractors: 'A,O,U,T',
    year: '2018',
    team: 'France',
    difficulty: 2
  },
  {
    word: 'EMILIANO',
    category: 'World Cup Epics',
    clue: 'Dibu Martinez, Argentine goalkeeper whose 123rd-minute leg save on Kolo Muani sealed the 2022 World Cup.',
    masked_pattern: 'E M _ L _ _ N O',
    missing_letters: 'I,I,A',
    distractors: 'E,O,U,R',
    year: '2022',
    team: 'Argentina',
    difficulty: 2
  },
  {
    word: 'DI MARIA',
    category: 'World Cup Epics',
    clue: 'Big-game angel who scored in the 2008 Olympics, 2021 Copa America, and the 2022 World Cup final.',
    masked_pattern: 'D _  M _ R _ A',
    missing_letters: 'I,A,I',
    distractors: 'E,O,U,T',
    year: '2022',
    team: 'Argentina',
    difficulty: 2
  },

  // ==========================================================================
  // SECTION 2: EUROPEAN CHAMPIONSHIPS (EUROS)
  // ==========================================================================
  {
    word: 'PONEDELNIK',
    category: 'European Championships',
    clue: 'Soviet forward who scored the 113th-minute extra-time winner to capture the first ever Euro in 1960.',
    masked_pattern: 'P _ N _ D E L N _ K',
    missing_letters: 'O,E,I',
    distractors: 'A,U,T,S',
    year: '1960',
    team: 'Soviet Union',
    difficulty: 3
  },
  {
    word: 'MARCELINO',
    category: 'European Championships',
    clue: 'His dramatic 84th-minute header against the Soviet Union gave Spain their first European title in 1964.',
    masked_pattern: 'M _ R C _ L I N O',
    missing_letters: 'A,E',
    distractors: 'I,O,U,T',
    year: '1964',
    team: 'Spain',
    difficulty: 2
  },
  {
    word: 'RIVA',
    category: 'European Championships',
    clue: 'Roar of Thunder, Italy\'s all-time top scorer who netted in the Euro 1968 final replay in Rome.',
    masked_pattern: 'R _ V _',
    missing_letters: 'I,A',
    distractors: 'E,O,U,T',
    year: '1968',
    team: 'Italy',
    difficulty: 1
  },
  {
    word: 'HRUBESCH',
    category: 'European Championships',
    clue: 'The Heading Monster who scored both goals for West Germany in the Euro 1980 final in Rome.',
    masked_pattern: 'H R _ B _ S C H',
    missing_letters: 'U,E',
    distractors: 'A,I,O,T',
    year: '1980',
    team: 'West Germany',
    difficulty: 3
  },
  {
    word: 'BIERHOFF',
    category: 'European Championships',
    clue: 'Scored football\'s first major Golden Goal at Wembley to crown Germany European champions in 1996.',
    masked_pattern: 'B _ _ R H O F F',
    missing_letters: 'I,E',
    distractors: 'A,O,U,K',
    year: '1996',
    team: 'Germany',
    difficulty: 2
  },
  {
    word: 'TREZEGUET',
    category: 'European Championships',
    clue: 'Blasted a ferocious 103rd-minute Golden Goal half-volley vs Italy to win Euro 2000 in Rotterdam.',
    masked_pattern: 'T R _ Z _ G U E T',
    missing_letters: 'E,E',
    distractors: 'A,I,O,S',
    year: '2000',
    team: 'France',
    difficulty: 2
  },
  {
    word: 'ZAGORAKIS',
    category: 'European Championships',
    clue: 'Player of the Tournament captain who lifted Greece\'s miracle Euro 2004 trophy in Lisbon.',
    masked_pattern: 'Z _ G _ R A K I S',
    missing_letters: 'A,O',
    distractors: 'E,I,U,T',
    year: '2004',
    team: 'Greece',
    difficulty: 2
  },
  {
    word: 'TORRES',
    category: 'European Championships',
    clue: 'El Niño, clipped the winning goal over Jens Lehmann in Vienna to end Spain\'s 44-year trophy drought in 2008.',
    masked_pattern: 'T _ R R _ S',
    missing_letters: 'O,E',
    distractors: 'A,I,U,T',
    year: '2008',
    team: 'Spain',
    difficulty: 1
  },
  {
    word: 'EDER',
    category: 'European Championships',
    clue: 'Unlikely Portuguese substitute who struck a 109th-minute 25-yard rocket to win Euro 2016 in Paris.',
    masked_pattern: 'E D _ R',
    missing_letters: 'E',
    distractors: 'A,I,O,U',
    year: '2016',
    team: 'Portugal',
    difficulty: 1
  },
  {
    word: 'DONNARUMMA',
    category: 'European Championships',
    clue: 'Player of the Tournament who saved decisive penalties from Sancho and Saka to win Euro 2020 at Wembley.',
    masked_pattern: 'D _ N N _ R U M M A',
    missing_letters: 'O,A',
    distractors: 'E,I,U,T',
    year: '2020',
    team: 'Italy',
    difficulty: 2
  },
  {
    word: 'YAMAL',
    category: 'European Championships',
    clue: '16-year-old Spanish wonderkid who scored an astonishing 25-yard curling equalizer in the Euro 2024 semifinal.',
    masked_pattern: 'Y _ M _ L',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2024',
    team: 'Spain',
    difficulty: 1
  },
  {
    word: 'RODRI',
    category: 'European Championships',
    clue: 'Spanish midfield general named Player of the Tournament at Euro 2024 in Germany.',
    masked_pattern: 'R _ D R _',
    missing_letters: 'O,I',
    distractors: 'A,E,U,T',
    year: '2024',
    team: 'Spain',
    difficulty: 1
  },
  {
    word: 'OYARZABAL',
    category: 'European Championships',
    clue: 'Spanish winger who slid in the 86th-minute winner against England in the Euro 2024 final in Berlin.',
    masked_pattern: 'O Y _ R Z _ B A L',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2024',
    team: 'Spain',
    difficulty: 2
  },

  // ==========================================================================
  // SECTION 3: CHAMPIONS LEAGUE & HISTORIC EUROPEAN CUPS
  // ==========================================================================
  {
    word: 'CELTIC',
    category: 'Champions League Miracles',
    clue: 'The Lisbon Lions of 1967, the first British team to become champions of Europe with all local players.',
    masked_pattern: 'C _ L T _ C',
    missing_letters: 'E,I',
    distractors: 'A,O,U,K',
    year: '1967',
    team: 'Celtic FC',
    difficulty: 1
  },
  {
    word: 'NOTTINGHAM',
    category: 'Champions League Miracles',
    clue: 'Brian Clough\'s miracle club who won back-to-back European Cups in 1979 (Munich) and 1980 (Madrid).',
    masked_pattern: 'N _ T T _ N G H A M',
    missing_letters: 'O,I',
    distractors: 'A,E,U,R',
    year: '1979',
    team: 'Nottingham Forest',
    difficulty: 2
  },
  {
    word: 'ASTON VILLA',
    category: 'Champions League Miracles',
    clue: 'Peter Withe scored off the post in Rotterdam 1982 to defeat Bayern Munich and claim the European Cup.',
    masked_pattern: 'A S T _ N  V _ L L A',
    missing_letters: 'O,I',
    distractors: 'E,U,R,T',
    year: '1982',
    team: 'Aston Villa',
    difficulty: 2
  },
  {
    word: 'DUCKADAM',
    category: 'Champions League Miracles',
    clue: 'Hero of Seville, Steaua Bucharest goalkeeper who saved all four Barcelona penalties in the 1986 final.',
    masked_pattern: 'D _ C K _ D A M',
    missing_letters: 'U,A',
    distractors: 'E,I,O,T',
    year: '1986',
    team: 'Steaua Bucharest',
    difficulty: 3
  },
  {
    word: 'RED STAR',
    category: 'Champions League Miracles',
    clue: 'Belgrade side featuring Savicevic and Prosinecki that won the 1991 European Cup on penalties in Bari.',
    masked_pattern: 'R _ D  S T _ R',
    missing_letters: 'E,A',
    distractors: 'O,I,U,K',
    year: '1991',
    team: 'Red Star Belgrade',
    difficulty: 1
  },
  {
    word: 'MARSEILLE',
    category: 'Champions League Miracles',
    clue: 'Basile Boli\'s header against Milan made them the first French club to win the Champions League in 1993.',
    masked_pattern: 'M _ R S _ _ L L E',
    missing_letters: 'A,E,I',
    distractors: 'O,U,T,K',
    year: '1993',
    team: 'Olympique de Marseille',
    difficulty: 2
  },
  {
    word: 'KLUIVERT',
    category: 'Champions League Miracles',
    clue: '18-year-old Dutch forward who came off the bench to toe-poke Ajax to the 1995 Champions League in Vienna.',
    masked_pattern: 'K L _ _ V E R T',
    missing_letters: 'U,I',
    distractors: 'A,E,O,T',
    year: '1995',
    team: 'Ajax',
    difficulty: 2
  },
  {
    word: 'RICKEN',
    category: 'Champions League Miracles',
    clue: 'Dortmund midfielder who chipped Angelo Peruzzi just 16 seconds after coming on in the 1997 Munich final.',
    masked_pattern: 'R _ C K _ N',
    missing_letters: 'I,E',
    distractors: 'A,O,U,T',
    year: '1997',
    team: 'Borussia Dortmund',
    difficulty: 2
  },
  {
    word: 'DECO',
    category: 'Champions League Miracles',
    clue: 'Portuguese midfield magician named Man of the Match in Jose Mourinho\'s 2004 Porto final triumph.',
    masked_pattern: 'D _ C _',
    missing_letters: 'E,O',
    distractors: 'A,I,U,R',
    year: '2004',
    team: 'FC Porto',
    difficulty: 1
  },
  {
    word: 'MILITO',
    category: 'Champions League Miracles',
    clue: 'El Principe, Argentine striker who scored both goals at the Bernabeu to seal Inter Milan\'s 2010 Treble.',
    masked_pattern: 'M _ L _ T O',
    missing_letters: 'I,I',
    distractors: 'A,E,O,U',
    year: '2010',
    team: 'Inter Milan',
    difficulty: 1
  },
  {
    word: 'SERGIO RAMOS',
    category: 'Champions League Miracles',
    clue: 'His 92:48 header against Atletico Madrid rescued Real Madrid and delivered the historic La Decima.',
    masked_pattern: 'S _ R G I O  R _ M O S',
    missing_letters: 'E,A',
    distractors: 'I,O,U,T',
    year: '2014',
    team: 'Real Madrid',
    difficulty: 2
  },
  {
    word: 'VINICIUS',
    category: 'Champions League Miracles',
    clue: 'Brazilian winger who tapped in the winning goal in the 2022 Champions League final in Paris.',
    masked_pattern: 'V _ N _ C I U S',
    missing_letters: 'I,I',
    distractors: 'A,E,O,T',
    year: '2022',
    team: 'Real Madrid',
    difficulty: 1
  },

  // ==========================================================================
  // SECTION 4: EUROPA LEAGUE & UEFA CUP LEGENDS
  // ==========================================================================
  {
    word: 'SEVILLA',
    category: 'Europa League & UEFA Cup',
    clue: 'The undisputed kings of the competition, lifting a record 7 UEFA Cup / Europa League trophies.',
    masked_pattern: 'S _ V _ L L A',
    missing_letters: 'E,I',
    distractors: 'A,O,U,T',
    year: 'Records',
    team: 'Sevilla FC',
    difficulty: 1
  },
  {
    word: 'FALCAO',
    category: 'Europa League & UEFA Cup',
    clue: 'El Tigre, scored 17 goals for Porto in 2011 and two in the 2012 final for Atletico Madrid.',
    masked_pattern: 'F _ L C _ O',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2011',
    team: 'Porto / Atletico Madrid',
    difficulty: 1
  },
  {
    word: 'LOOKMAN',
    category: 'Europa League & UEFA Cup',
    clue: 'Nigerian winger who scored an astonishing final hat-trick for Atalanta to crush Leverkusen in Dublin 2024.',
    masked_pattern: 'L _ _ K M A N',
    missing_letters: 'O,O',
    distractors: 'A,E,I,U',
    year: '2024',
    team: 'Atalanta',
    difficulty: 2
  },
  {
    word: 'FRANKFURT',
    category: 'Europa League & UEFA Cup',
    clue: 'German side who invaded Barcelona with 30,000 fans and defeated Rangers on penalties in Seville 2022.',
    masked_pattern: 'F R _ N K F _ R T',
    missing_letters: 'A,U',
    distractors: 'E,I,O,T',
    year: '2022',
    team: 'Eintracht Frankfurt',
    difficulty: 2
  },
  {
    word: 'VILLARREAL',
    category: 'Europa League & UEFA Cup',
    clue: 'The Yellow Submarine who won a marathon 11-10 penalty shootout against Manchester United in 2021.',
    masked_pattern: 'V _ L L _ R R E A L',
    missing_letters: 'I,A',
    distractors: 'E,O,U,T',
    year: '2021',
    team: 'Villarreal CF',
    difficulty: 2
  },
  {
    word: 'SHAKHTAR',
    category: 'Europa League & UEFA Cup',
    clue: 'Ukrainian club propelled by Brazilian stars who won the final UEFA Cup before the rebrand in Istanbul 2009.',
    masked_pattern: 'S H _ K H T _ R',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2009',
    team: 'Shakhtar Donetsk',
    difficulty: 2
  },
  {
    word: 'GALATASARAY',
    category: 'Europa League & UEFA Cup',
    clue: 'First Turkish club to win a European trophy, defeating Arsenal on penalties in Copenhagen in 2000.',
    masked_pattern: 'G _ L _ T _ S A R A Y',
    missing_letters: 'A,A,A',
    distractors: 'E,I,O,U',
    year: '2000',
    team: 'Galatasaray',
    difficulty: 3
  },
  {
    word: 'PARMA',
    category: 'Europa League & UEFA Cup',
    clue: 'Cult 1990s Italian side featuring Buffon, Cannavaro, Thuram, and Crespo who won the UEFA Cup in 1995 and 1999.',
    masked_pattern: 'P _ R M _',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '1999',
    team: 'Parma AC',
    difficulty: 1
  },
  {
    word: 'SIMEONE',
    category: 'Europa League & UEFA Cup',
    clue: 'El Cholo, Argentine manager who transformed Atletico Madrid, winning the Europa League in 2012 and 2018.',
    masked_pattern: 'S _ M _ O N E',
    missing_letters: 'I,E',
    distractors: 'A,O,U,R',
    year: '2012',
    team: 'Atletico Madrid',
    difficulty: 1
  },

  // ==========================================================================
  // SECTION 5: AFRICAN CUP OF NATIONS (AFCON) & AFRICAN GIANTS
  // ==========================================================================
  {
    word: 'EGYPT',
    category: 'African Cup of Nations',
    clue: 'The Pharaohs, record 7-time AFCON champions who achieved a legendary three-peat (2006, 2008, 2010).',
    masked_pattern: 'E G _ P _',
    missing_letters: 'Y,T',
    distractors: 'A,I,O,U',
    year: 'Record',
    team: 'Egypt',
    difficulty: 1
  },
  {
    word: 'ETO O',
    category: 'African Cup of Nations',
    clue: 'All-time leading goalscorer in AFCON history (18 goals) and 4-time African Player of the Year for Cameroon.',
    masked_pattern: 'E T _  _',
    missing_letters: 'O,O',
    distractors: 'A,E,I,U',
    year: '2000',
    team: 'Cameroon',
    difficulty: 1
  },
  {
    word: 'MANE',
    category: 'African Cup of Nations',
    clue: 'Scored the winning sudden-death penalty to hand Senegal their first ever AFCON championship in 2021.',
    masked_pattern: 'M _ N _',
    missing_letters: 'A,E',
    distractors: 'I,O,U,R',
    year: '2021',
    team: 'Senegal',
    difficulty: 1
  },
  {
    word: 'SALAH',
    category: 'African Cup of Nations',
    clue: 'Egyptian King who led his nation to two AFCON finals and their first World Cup in 28 years.',
    masked_pattern: 'S _ L _ H',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2017',
    team: 'Egypt',
    difficulty: 1
  },
  {
    word: 'ABOUTRIKA',
    category: 'African Cup of Nations',
    clue: 'Egyptian playmaker who scored the winning goal in the 2008 AFCON final and the 2006 penalty shootout.',
    masked_pattern: 'A B _ _ T R I K A',
    missing_letters: 'O,U',
    distractors: 'E,I,A,S',
    year: '2008',
    team: 'Egypt / Al Ahly',
    difficulty: 3
  },
  {
    word: 'OKOCHA',
    category: 'African Cup of Nations',
    clue: 'Jay-Jay, so good they named him twice, dribbling maestro who won the 1994 AFCON and 1996 Olympic Gold.',
    masked_pattern: 'O K _ C H _',
    missing_letters: 'O,A',
    distractors: 'E,I,U,T',
    year: '1994',
    team: 'Nigeria',
    difficulty: 1
  },
  {
    word: 'GEORGE WEAH',
    category: 'African Cup of Nations',
    clue: 'Liberian legend who remains the only African player to win the Ballon d\'Or and FIFA World Player of the Year.',
    masked_pattern: 'G _ O R G E  W _ _ H',
    missing_letters: 'E,E,A',
    distractors: 'I,O,U,T',
    year: '1995',
    team: 'Liberia / Milan',
    difficulty: 2
  },
  {
    word: 'ZAMBIA',
    category: 'African Cup of Nations',
    clue: 'Under Herve Renard, they won the emotional 2012 AFCON in Libreville, where their 1993 plane had crashed.',
    masked_pattern: 'Z _ M B _ A',
    missing_letters: 'A,I',
    distractors: 'E,O,U,T',
    year: '2012',
    team: 'Zambia',
    difficulty: 2
  },
  {
    word: 'HALLER',
    category: 'African Cup of Nations',
    clue: 'Overcame testicular cancer to score the dramatic 81st-minute final winner for hosts Ivory Coast at AFCON 2024.',
    masked_pattern: 'H _ L L _ R',
    missing_letters: 'A,E',
    distractors: 'O,I,U,T',
    year: '2024',
    team: 'Ivory Coast',
    difficulty: 2
  },
  {
    word: 'YAYA TOURE',
    category: 'African Cup of Nations',
    clue: 'Midfield powerhouse who captained Ivory Coast to the 2015 AFCON title and won 4 African Player of the Year awards.',
    masked_pattern: 'Y _ Y A  T _ _ R E',
    missing_letters: 'A,O,U',
    distractors: 'E,I,R,T',
    year: '2015',
    team: 'Ivory Coast / Man City',
    difficulty: 2
  },
  {
    word: 'ABEDI PELE',
    category: 'African Cup of Nations',
    clue: 'Ghanaian legend who won the 1982 AFCON at age 17 and won the 1993 Champions League with Marseille.',
    masked_pattern: 'A B _ D I  P _ L E',
    missing_letters: 'E,E',
    distractors: 'A,I,O,U',
    year: '1982',
    team: 'Ghana / Marseille',
    difficulty: 2
  },
  {
    word: 'MAHREZ',
    category: 'African Cup of Nations',
    clue: 'Algerian captain whose 95th-minute curling free-kick against Nigeria sent the Desert Foxes to the 2019 AFCON title.',
    masked_pattern: 'M _ H R _ Z',
    missing_letters: 'A,E',
    distractors: 'I,O,U,T',
    year: '2019',
    team: 'Algeria / Man City',
    difficulty: 1
  },
  {
    word: 'BAFANA',
    category: 'African Cup of Nations',
    clue: 'Bafana Bafana, South Africa\'s national team who won AFCON 1996 in Johannesburg watched by Nelson Mandela.',
    masked_pattern: 'B _ F _ N A',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '1996',
    team: 'South Africa',
    difficulty: 1
  },
  {
    word: 'YEKINI',
    category: 'African Cup of Nations',
    clue: 'Rashidi, Nigerian goal king who won the 1994 AFCON and famously gripped the net after Nigeria\'s first World Cup goal.',
    masked_pattern: 'Y _ K _ N I',
    missing_letters: 'E,I',
    distractors: 'A,O,U,T',
    year: '1994',
    team: 'Nigeria',
    difficulty: 2
  },
  {
    word: 'EL HADARY',
    category: 'African Cup of Nations',
    clue: 'Egyptian goalkeeper who won 4 AFCON titles and became the oldest player in World Cup history at age 45.',
    masked_pattern: 'E L  H _ D _ R Y',
    missing_letters: 'A,A',
    distractors: 'E,I,O,U',
    year: '2010',
    team: 'Egypt',
    difficulty: 3
  }
];

module.exports = { TOURNAMENTS_WORDS };
