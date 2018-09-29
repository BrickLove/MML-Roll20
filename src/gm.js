MML.gm = function GM(roll20_player_object) {
  const gm = this;
  gm.id = roll20_player_object.get('id');
  gm.name = roll20_player_object.get('name');
  gm.characters = MML.characters.pipe(
    mergeMap(character => Rx.combineLatest(character.gm)),
    filter(),
    scan(function (list, character) {
      list[character.id] = character;
      return character;
    })
  );

  const button_pressed = gm.name.pipe(switchMap(name => MML.button_pressed.pipe(filter(message => name === message.who))));

  const router = button_pressed.pipe(pluck('content'));
  const selected_ids = button_pressed.pipe(pluck('selected'));

  const idle = router.filter('/');
  const main_menu = idle.pipe(MML.listenForRoute(router, '/gm'));
  const combat_menu = main_menu.pipe(MML.listenForRoute(router, '/gm/combat'));
  const start_combat = combat_menu.pipe(switchMapTo(Rx.zip(
    selected_ids.pipe(filter(ids => ids.length > 0)),
    MML.listenForRoute(router, '/gm/combat/start')
  )));
  const end_combat = start_combat.pipe(MML.listenForRoute(router, '/gm/combat/end'));
  const ex_machina_menu = main_menu.pipe(MML.listenForRoute(router, '/gm/ex_machina'));
  const add_status_effect = ex_machina_menu.pipe(MML.listenForRoute(router, '/gm/ex_machina/add_status_effect'))
  const remove_status_effect = ex_machina_menu.pipe(MML.listenForRoute(router, '/gm/ex_machina/remove_status_effect'))

  const no_combatants = start_combat.pipe(filter(ids => ids.length > 0), tap(() => sendChat('', 'No Tokens Selected')));
  const combatants = start_combat.pipe(
    filter(ids => ids.length > 0),
    switchMap(ids => MML.characters.pipe(filter(character => ids.includes(character.id)))),
    switchMap(ids => Rx.of(ids))
  );

  const combatants_ready = combatants.pipe(
    pluck('ready'),
    combineAll(),
    filter(all_ready => all_ready.every(ready => ready))
  );

  Rx.merge(start_combat.pipe(mapTo('true')), end_combat.pipe(mapTo('false'))).subscribe(show => Campaign().set('initiativepage', show));

  const turn_order = combatants_ready.pipe(
    switchMapTo(combatants),
    pluck('initiative'),
    concatAll(),
    zip(combatants),
    toArray(),
    map(function (characters) {
      characters.sort((character_a, character_b) => character_b[0] - character_a[0]);
      return characters.map(([initiative, character]) => character);
    })
  );

  turn_order.pipe(
      switchMap(characters => Rx.zip(characters.map(character => [character.token_id, character.initiative]))),
      map(([token_id, initiative]) => ({ id: token_id, pr: initiative, custom: '' })),
      toArray()
    )
    .subscribe(function (turn_order) {
      Campaign().set('turnorder', JSON.stringify(turn_order));
    })

  const actor = turn_order.pipe(map(characters => characters[0]));

  const current_action = actor.pipe(pluck('action'));

  const round_started = combatants_ready.pipe(switchMapTo(router), filter('/gm/combat/start_round'));
  const round_ended = combatants.pipe(
    pluck('initiative'),
    toArray(),
    switchMap(initiatives => Rx.combineLatest(initiatives)),
    filter(initiatives => initiatives.every(initiative => initiative < 1)),
    merge(end_combat)
  );

  const game_state = Rx.merge(
    current_action,
    add_status_effect,
    remove_status_effect
  );

  main_menu.pipe(switchMapTo(gm.name)).subscribe(function (name) {
    const buttons = [
      new Menu.Button('Combat', '/gm/combat'),
      new Menu.Button('Exploration', '/gm/exploration'),
      new Menu.Button('Ex Machina', '/gm/ex_machina'),
      new Menu.Button('Pass Time', '/gm/pass_time'),
      new Menu.Button('Exit', '/')
    ];
    MML.displayMenu(name, 'Main Menu: ', buttons);
  });

  Rx.merge(combat_menu, no_combatants).pipe(switchMapTo(gm.name)).subscribe(function (name) {
    const buttons = [
      new Menu.Button('Start', '/gm/combat/start'),
      new Menu.Button('Exit', '/')
    ];
    MML.displayMenu(name, 'Main Menu: ', buttons);
  });

  round_ended.pipe(switchMapTo(gm.name)).subscribe(function (name) {
    const buttons = [
      new Menu.Button('Start Round', '/gm/combat/start_round'),
      new Menu.Button('End Combat', '/')
    ];
    MML.displayMenu(name, 'Main Menu: ', buttons);
  });

  ex_machina_menu.pipe(switchMapTo(gm.name)).subscribe(function (name) {
    const buttons = [
      new Menu.Button('Add Status Effect', '/gm/ex_machina/add_status_effect'),
      new Menu.Button('Remove Status Effect', '/gm/ex_machina/remove_status_effect'),
      new Menu.Button('Back', '/gm/ex_machina'),
      new Menu.Button('Exit', '/')
    ];
    MML.displayMenu(name, 'Main Menu: ', buttons);
  });
};

MML.displayThreatZones = function displayThreatZones(toggle) {
  _.each(state.MML.gm.allCombatants, function (character) {
    var token = MML.getCharacterToken(character.id);
    var radius1 = '';
    var radius2 = '';
    var color1 = '#FF0000';
    var color2 = '#FFFF00';
    if (toggle && !MML.isWieldingRangedWeapon(character) && !MML.isUnarmed(character)) {
      var weapon = MML.getEquippedWeapon(character);
      radius1 = MML.weaponRanks[weapon.rank].high;
      radius2 = MML.weaponRanks[weapon.rank + 1].high;
    }
    MML.displayAura(token, radius1, 1, color1);
    MML.displayAura(token, radius2, 2, color2);
  });
};
