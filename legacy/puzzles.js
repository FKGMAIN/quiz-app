// Soccer Legends: Historic Scenario Puzzle Database
const SOCCER_PUZZLES = [
  // CATEGORY 1: World Cup Epics & Iconic Dramas
  {
    id: 'wc-1',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '1986: The Hand & The Century',
    text: 'In Mexico City, Diego Maradona scored his infamous {{0}} of God, followed four minutes later by the breathtaking 60-meter dribble voted Goal of the {{1}} against England.',
    missingWords: ['HAND', 'CENTURY'],
    distractors: ['HEAD', 'DECADE', 'FOOT', 'TOURNAMENT'],
    hint: 'First a controversial punch over Peter Shilton, then the greatest solo run in World Cup history.',
    firstLetters: ['H', 'C'],
    year: '1986',
    teams: 'Argentina vs England'
  },
  {
    id: 'wc-2',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '1950: The Maracanazo Silence',
    text: 'Over 200,000 Brazilian fans in Rio fell dead silent when Uruguay winger Alcides {{0}} scored the winning goal past goalkeeper {{1}} to steal the trophy.',
    missingWords: ['GHIGGIA', 'BARBOSA'],
    distractors: ['SCHIAFFINO', 'GILMAR', 'VARELA', 'CASTILHO'],
    hint: 'The Uruguayan hero declared: "Only three people have silenced the Maracanã: Frank Sinatra, the Pope, and me."',
    firstLetters: ['G', 'B'],
    year: '1950',
    teams: 'Uruguay vs Brazil'
  },
  {
    id: 'wc-3',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '2006: The Final Headbutt',
    text: 'In extra time of his final career match, French maestro Zinedine {{0}} was sent off with a red card for headbutting Italian defender Marco {{1}}.',
    missingWords: ['ZIDANE', 'MATERAZZI'],
    distractors: ['HENRY', 'CANNAVARO', 'VIEIRA', 'GROSSO'],
    hint: 'The legendary French number 10 clashed with the Italian goalscorer in Berlin.',
    firstLetters: ['Z', 'M'],
    year: '2006',
    teams: 'Italy vs France'
  },
  {
    id: 'wc-4',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '2022: Lusail Thriller',
    text: 'Lionel Messi finally hoisted the World Cup in Qatar after Kylian {{0}} scored a miraculous hat-trick, with Argentina prevailing 4-2 on {{1}}.',
    missingWords: ['MBAPPE', 'PENALTIES'],
    distractors: ['GRIEZMANN', 'HEADERS', 'BENZEMA', 'EXTRA-TIME'],
    hint: 'The French speedster netted three times before the dramatic penalty shootout.',
    firstLetters: ['M', 'P'],
    year: '2022',
    teams: 'Argentina vs France'
  },
  {
    id: 'wc-5',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '1970: Pelé & The Aztec Glory',
    text: 'Pelé captured his third World Cup as Brazil swept Italy 4-1 at the {{0}} Stadium, permanently keeping the original Jules {{1}} Trophy.',
    missingWords: ['AZTECA', 'RIMET'],
    distractors: ['MARACANA', 'DELAUNAY', 'BERNABEU', 'CHAMPION'],
    hint: 'Mexico City iconic arena and the historic trophy stolen and melted down in 1983.',
    firstLetters: ['A', 'R'],
    year: '1970',
    teams: 'Brazil vs Italy'
  },
  {
    id: 'wc-6',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '2014: The Mineirazo Shock',
    text: 'In the most lopsided semifinal in football history, Germany dismantled hosts Brazil by an astonishing {{0}} scoreline in {{1}}.',
    missingWords: ['7-1', 'BELO-HORIZONTE'],
    distractors: ['5-0', 'RIO-DE-JANEIRO', '6-1', 'SAO-PAULO'],
    hint: 'Klose broke the World Cup scoring record during a 5-goal blitz in the first 29 minutes.',
    firstLetters: ['7', 'B'],
    year: '2014',
    teams: 'Brazil vs Germany'
  },
  {
    id: 'wc-7',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '1994: The Divine Ponytail Heartbreak',
    text: 'Under scorching Pasadena heat, Italy talisman Roberto {{0}} famously blasted his decisive shootout kick high over the {{1}} against Brazil.',
    missingWords: ['BAGGIO', 'CROSSBAR'],
    distractors: ['BARESI', 'POST', 'MALDINi', 'KEEPER'],
    hint: 'The Italian Ballon d\'Or winner stood motionless with bowed head on the spot.',
    firstLetters: ['B', 'C'],
    year: '1994',
    teams: 'Brazil vs Italy'
  },
  {
    id: 'wc-8',
    realm: 'World Cup Epics',
    realmIcon: '🏆',
    title: '1966: Wembley Hat-Trick',
    text: 'Geoff {{0}} wrote his name into history by scoring the first World Cup final hat-trick as England defeated West Germany 4-2 at {{1}}.',
    missingWords: ['HURST', 'WEMBLEY'],
    distractors: ['CHARLTON', 'ANFIELD', 'MOORE', 'TRAFFORD'],
    hint: 'The famous crossbar controversy under the twin towers in London.',
    firstLetters: ['H', 'W'],
    year: '1966',
    teams: 'England vs West Germany'
  },

  // CATEGORY 2: Champions League Miracles & European Nights
  {
    id: 'ucl-1',
    realm: 'Champions League Miracles',
    realmIcon: '⭐',
    title: '2005: Miracle of Istanbul',
    text: 'Trailing 3-0 to AC Milan at the break, Liverpool captain Steven {{0}} ignited a six-minute comeback before Jerzy {{1}} dazzled in the shootout.',
    missingWords: ['GERRARD', 'DUDEK'],
    distractors: ['ALONSO', 'REINA', 'CARRAGHER', 'BUFFON'],
    hint: 'The Liverpool captain\'s looping header and the Polish goalkeeper\'s "spaghetti legs" dance.',
    firstLetters: ['G', 'D'],
    year: '2005',
    teams: 'Liverpool vs AC Milan'
  },
  {
    id: 'ucl-2',
    realm: 'Champions League Miracles',
    realmIcon: '⭐',
    title: '1999: Treble Stoppage Time',
    text: 'Trailing Bayern Munich into injury time at Camp Nou, Teddy Sheringham equalized before Ole Gunnar {{0}} poked home the dramatic {{1}}.',
    missingWords: ['SOLSKJAER', 'WINNER'],
    distractors: ['BECKHAM', 'HEADER', 'GIGGS', 'EQUALIZER'],
    hint: 'The "Baby-faced Assassin" from Norway secured Sir Alex Ferguson\'s historic Treble.',
    firstLetters: ['S', 'W'],
    year: '1999',
    teams: 'Manchester United vs Bayern Munich'
  },
  {
    id: 'ucl-3',
    realm: 'Champions League Miracles',
    realmIcon: '⭐',
    title: '2017: La Remontada',
    text: 'After losing 4-0 in Paris, Barcelona completed the greatest comeback in UCL history with a {{0}} victory sealed by Sergi {{1}} in the 95th minute.',
    missingWords: ['6-1', 'ROBERTO'],
    distractors: ['5-0', 'SUAREZ', '6-2', 'INIESTA'],
    hint: 'Neymar\'s masterclass and an unexpected La Masia hero lunging at the back post.',
    firstLetters: ['6', 'R'],
    year: '2017',
    teams: 'Barcelona vs Paris Saint-Germain'
  },
  {
    id: 'ucl-4',
    realm: 'Champions League Miracles',
    realmIcon: '⭐',
    title: '2002: Zidane\'s Glasgow Volley',
    text: 'At Hampden Park, Zinedine Zidane tracked Roberto Carlos\'s high looping cross and struck a majestic left-foot {{0}} into the top corner against Bayer {{1}}.',
    missingWords: ['VOLLEY', 'LEVERKUSEN'],
    distractors: ['HEADER', 'MUNICH', 'STRIKE', 'DORTMUND'],
    hint: 'Widely celebrated as the greatest goal in European Cup final history.',
    firstLetters: ['V', 'L'],
    year: '2002',
    teams: 'Real Madrid vs Bayer Leverkusen'
  },
  {
    id: 'ucl-5',
    realm: 'Champions League Miracles',
    realmIcon: '⭐',
    title: '2012: Drogba\'s Munich Redemption',
    text: 'Chelsea striker Didier {{0}} equalized in the 88th minute with a bullet header and stroked home the final penalty past Manuel {{1}} in Munich.',
    missingWords: ['DROGBA', 'NEUER'],
    distractors: ['LAMPARD', 'CECH', 'TORRES', 'KAHN'],
    hint: 'The Ivorian legend claimed Chelsea\'s maiden Champions League title in Bayern\'s backyard.',
    firstLetters: ['D', 'N'],
    year: '2012',
    teams: 'Chelsea vs Bayern Munich'
  },

  // CATEGORY 3: Fairytales, Underdogs & Tactical Legends
  {
    id: 'legend-1',
    realm: 'Legends & Underdog Fairytales',
    realmIcon: '🛡️',
    title: '2016: Leicester 5000-to-1 Miracle',
    text: 'Defying 5,000-to-1 pre-season odds, manager Claudio Ranieri guided {{0}} City to the Premier League title fueled by Jamie {{1}}\'s record goal streak.',
    missingWords: ['LEICESTER', 'VARDY'],
    distractors: ['BLACKBURN', 'MAHREZ', 'NEWCASTLE', 'KANTE'],
    hint: 'The Foxes crowned champions as their non-league turned talisman scored in 11 consecutive matches.',
    firstLetters: ['L', 'V'],
    year: '2016',
    teams: 'Premier League'
  },
  {
    id: 'legend-2',
    realm: 'Legends & Underdog Fairytales',
    realmIcon: '🛡️',
    title: '1974: Total Football Architecture',
    text: 'Dutch visionary Johan {{0}} and coach Rinus Michels captivated the world with "{{1}} Football", where outfield players interchange positions fluidly.',
    missingWords: ['CRUYFF', 'TOTAL'],
    distractors: ['NEESKENS', 'TIKI-TAKA', 'GULLIT', 'CATENACCIO'],
    hint: 'The iconic number 14 famed for his turn and Ajax/Barcelona tactical philosophy.',
    firstLetters: ['C', 'T'],
    year: '1974',
    teams: 'Netherlands'
  },
  {
    id: 'legend-3',
    realm: 'Legends & Underdog Fairytales',
    realmIcon: '🛡️',
    title: '2004: Greece\'s Euro Shock',
    text: 'Underdog Greece stunned host nation Portugal in Lisbon when striker Angelos {{0}} headed home from a corner to win the European {{1}}.',
    missingWords: ['CHARISTEAS', 'CHAMPIONSHIP'],
    distractors: ['ZAGORAKIS', 'CUP', 'KARAGOUNIS', 'TROPHY'],
    hint: 'Otto Rehhagel\'s resolute defensive side defeated Cristiano Ronaldo and Figo.',
    firstLetters: ['C', 'C'],
    year: '2004',
    teams: 'Greece vs Portugal'
  },
  {
    id: 'legend-4',
    realm: 'Legends & Underdog Fairytales',
    realmIcon: '🛡️',
    title: '2004: The Arsenal Invincibles',
    text: 'Under French manager Arsene Wenger, Arsenal became the only modern team to complete an entire 38-game league campaign completely {{0}}, led by Thierry {{1}}.',
    missingWords: ['UNDEFEATED', 'HENRY'],
    distractors: ['UNBEATEN', 'BERGKAMP', 'VICTORIOUS', 'VIEIRA'],
    hint: '26 wins, 12 draws, 0 losses, and a special Gold Premier League trophy.',
    firstLetters: ['U', 'H'],
    year: '2004',
    teams: 'Arsenal'
  },
  {
    id: 'legend-5',
    realm: 'Legends & Underdog Fairytales',
    realmIcon: '🛡️',
    title: 'The Black Spider of Moscow',
    text: 'The only goalkeeper in history to win the Ballon {{0}}, Soviet giant Lev Yashin famously stopped over 150 career {{1}}.',
    missingWords: ['DOR', 'PENALTIES'],
    distractors: ['GOLD', 'FREE-KICKS', 'BALL', 'SHOOTS'],
    hint: 'The legendary Dynamo Moscow keeper who played exclusively dressed in black.',
    firstLetters: ['D', 'P'],
    year: '1963',
    teams: 'Soviet Union'
  }
];

// Extra Pool for Blitz & Quick Match
const SOCCER_BLITZ_POOL = [
  {
    realm: 'Soccer Trivia Blitz',
    realmIcon: '⚡',
    title: '1958: The 17-Year-Old King',
    text: 'At just 17 years of age, Brazil\'s {{0}} scored twice in the final against hosts {{1}} to announce his royalty to the world.',
    missingWords: ['PELE', 'SWEDEN'],
    distractors: ['GARRINCHA', 'FRANCE', 'ZITO', 'GERMANY'],
    hint: 'The youngest goalscorer in World Cup final history.',
    firstLetters: ['P', 'S'],
    year: '1958'
  },
  {
    realm: 'Soccer Trivia Blitz',
    realmIcon: '⚡',
    title: '1998: Zidane\'s Two Headers',
    text: 'At the Stade de France, Zinedine Zidane struck two first-half {{0}} from corners to dethrone defending champions {{1}} 3-0.',
    missingWords: ['HEADERS', 'BRAZIL'],
    distractors: ['VOLLEYS', 'ITALY', 'PENALTIES', 'HOLLAND'],
    hint: 'France\'s first ever World Cup triumph on home soil.',
    firstLetters: ['H', 'B'],
    year: '1998'
  },
  {
    realm: 'Soccer Trivia Blitz',
    realmIcon: '⚡',
    title: '1954: Miracle of Bern',
    text: 'West Germany stunned Hungary\'s undefeated "{{0}} Magyars" 3-2 in Bern thanks to two late goals by Helmut {{1}}.',
    missingWords: ['MIGHTY', 'RAHN'],
    distractors: ['GOLDEN', 'PUSKAS', 'ROYAL', 'KOCSIS'],
    hint: 'Sepp Herberger\'s side overturned an early 2-0 deficit against Puskás\'s juggernaut.',
    firstLetters: ['M', 'R'],
    year: '1954'
  },
  {
    realm: 'Soccer Trivia Blitz',
    realmIcon: '⚡',
    title: '1996: Gazza\'s Wembley Flick',
    text: 'Paul Gascoigne flicked the ball over Colin Hendry before volleying past the keeper against rival {{0}} at Euro 96, celebrating with the {{1}} chair.',
    missingWords: ['SCOTLAND', 'DENTIST'],
    distractors: ['GERMANY', 'BARBER', 'ENGLAND', 'DOCTOR'],
    hint: 'Iconic celebration mocking British tabloid water-squirting photos.',
    firstLetters: ['S', 'D'],
    year: '1996'
  },
  {
    realm: 'Soccer Trivia Blitz',
    realmIcon: '⚡',
    title: '2019: Corner Taken Quickly',
    text: 'Liverpool completed a 4-0 comeback against Barcelona after Trent Alexander-{{0}} caught the defense sleeping with a corner for Divock {{1}}.',
    missingWords: ['ARNOLD', 'ORIGI'],
    distractors: ['ROBERTSON', 'MANE', 'HENDERSON', 'FIRMINO'],
    hint: 'The fastest-thinking corner in Anfield folklore.',
    firstLetters: ['A', 'O'],
    year: '2019'
  }
];

window.PUZZLE_DATA = SOCCER_PUZZLES;
window.BLITZ_EXTRA_POOL = SOCCER_BLITZ_POOL;
