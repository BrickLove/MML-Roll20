MML.startCombat = function startCombat(input) {
  this.currentRound = 1;
  this.combatants = input.selectedCharNames;

  if (this.combatants.length > 0) {
    this.inCombat = true;
    _.each(state.MML.players, function (player) {
      player.combatants = [];
    });
    _.each(this.combatants, function(charName) {
      state.MML.players[state.MML.characters[charName].player].combatants.push(charName);
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "setApiCharAttribute",
        input: {
          attribute: "ready",
          value: false
        }
      });
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "setCombatVision",
        input: {
          inCombat: true
        }
      });
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "updateCharacter",
        input: {
          attribute: "initiative"
        }
      });
    });

    MML.processCommand({
      type: "GM",
      callback: "setTurnOrder",
      input: {}
    });

    Campaign().set("initiativepage", "true");

    MML.processCommand({
      type: "GM",
      callback: "newRound",
      input: {}
    });
  } else {
    sendChat("", "&{template:charMenu} {{name=Error}} {{message=No tokens selected}}");

    MML.processCommand({
      type: "player",
      who: this.player,
      callback: "setApiPlayerAttribute",
      input: {
        buttons: [MML.menuButtons.combatMenu]
      }
    });
    MML.processCommand({
      type: "player",
      who: this.player,
      callback: "menuCommand",
      input: {
        who: this.player,
        buttonText: "Combat"
      }
    });
  }
};

MML.newRound = function newRound() {
  this.currentRound++;
  this.roundStarted = false;
  _.each(this.combatants, function(charName) {
    MML.processCommand({
      type: "character",
      who: charName,
      callback: "newRoundUpdateCharacter",
      input: {}
    });
  });
  _.each(state.MML.players, function(player) {
    MML.processCommand({
      type: "player",
      who: player.name,
      callback: "newRoundUpdatePlayer",
      input: {
        who: player.who
      }
    });
  });
};

MML.startRound = function startRound() {
  if (MML.checkReady()) {
    this.roundStarted = true;

    _.each(this.combatants, function(charName) {
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "updateCharacter",
        input: {
          attribute: "initiativeRoll"
        }
      });
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "setApiCharAttribute",
        input: {
          attribute: "movementAvailable",
          value: state.MML.characters[charName].movementRatio
        }
      });
    });

    MML.processCommand({
      type: "GM",
      callback: "nextAction",
      input: {}
    });
  }
};

MML.endCombat = function endCombat() {
  if (this.combatants.length > 0) {
    _.each(this.combatants, function(charName) {
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "setApiCharAttribute",
        input: {
          attribute: "ready",
          value: true
        }
      });
      MML.processCommand({
        type: "character",
        who: charName,
        callback: "setCombatVision",
        input: {
          inCombat: false
        }
      });
    });
    this.inCombat = false;
    this.combatants = [];
    Campaign().set("initiativepage", "false");
  }
};

MML.nextAction = function nextAction() {
  MML.processCommand({
    type: "GM",
    callback: "setTurnOrder",
    input: {}
  });

  if (MML.checkReady()) {
    if (state.MML.characters[this.combatants[0]].initiative > 0) {
      this.actor = this.combatants[0];
      var playerName = state.MML.characters[this.actor].player;

      MML.processCommand({
        type: "player",
        who: playerName,
        callback: "charMenuStartAction",
        input: {
          who: this.actor,
          actionValid: MML.validateAction(state.MML.characters[this.actor])
        }
      });
      MML.processCommand({
        type: "player",
        who: playerName,
        callback: "displayMenu",
        input: {}
      });
    } else {
      MML.processCommand({
        type: "GM",
        callback: "newRound",
        input: {}
      });
    }
  }
};

MML.getSingleTarget = function getSingleTarget(input) {
  input.charName = this.name;
  input.callback = "setCurrentCharacterTargets";
  MML.displayTargetSelection(input);
};

MML.getSpellTargets = function getSpellTargets(input) {
  input.charName = this.name;
  input.callback = "getAdditionTarget";
  MML.displayTargetSelection(input);
};

MML.getRadiusSpellTargets = function getRadiusSpellTargets(input) {
  state.MML.GM.currentAction.parameters.spellMarker = "spellMarkerCircle";
  var token = MML.getTokenFromChar(this.name);
  var graphic = createObj('graphic', {
       name: "spellMarkerCircle",
       _pageid: token.get("_pageid"),
       layer: "objects",
       left: token.get("left"),
       top: token.get("top"),
       width: MML.feetToPixels(input.radius*2),
       height: MML.feetToPixels(input.radius*2),
       imgsrc: "https://s3.amazonaws.com/files.d20.io/images/27869253/ixTcySIkxTEEsbospj4PpA/thumb.png?1485314508",
       controlledby: MML.getPlayerFromName(this.player).get("id")
     });
   toBack(graphic);

   MML.processCommand({
     type: "player",
     who: this.player,
     callback: "charMenuPlaceSpellMarker",
     input: { who: this.name }
   });
   MML.processCommand({
     type: "player",
     who: this.player,
     callback: "displayMenu",
     input: {}
   });
};

MML.setTargets = function setTargets() {
  this.targets = this.characters[this.actor].action.targets;
  this.targetIndex = 0;
  this.currentTarget = this.targets[0];
};

MML.checkReady = function checkReady() {
  var everyoneReady = true;

  _.each(state.MML.GM.combatants, function(charName) {
    if (state.MML.characters[charName].ready === false) {
      everyoneReady = false;
    }
  });

  return everyoneReady;
};

MML.displayThreatZones = function displayThreatZones(input) {
  var toggle = input.toggle;
  _.each(this.combatants, function(combatant) {
    var character = state.MML.characters[combatant];
    var token = MML.getTokenFromChar(combatant);
    var radius1 = "";
    var radius2 = "";
    var color1 = "#FF0000";
    var color2 = "#FFFF00";
    if (toggle && !MML.isWieldingRangedWeapon(character) && !MML.isUnarmed(character)) {
      var weapon = MML.getMeleeWeapon(character);
      radius1 = MML.weaponRanks[weapon.rank].high;
      radius2 = MML.weaponRanks[weapon.rank + 1].high;
    }
    MML.displayAura(token, radius1, 1, color1);
    MML.displayAura(token, radius2, 2, color2);
  });
};

// Turn Order Functions
MML.setTurnOrder = function setTurnOrder() {
  var turnorder = [];

  var index;
  for (index in this.combatants) {
    turnorder.push({
      id: MML.getTokenFromChar(this.combatants[index]).id,
      pr: state.MML.characters[this.combatants[index]].initiative,
      custom: ""
    });
  }

  turnorder.sort(function(a, b) {
    if (parseFloat(b.pr) === parseFloat(a.pr)) {
      if (a.custom !== "" && b.custom !== "") {
        return parseFloat(b.custom) - parseFloat(a.custom);
      } else {
        return 0;
      }
    } else {
      return parseFloat(b.pr) - parseFloat(a.pr);
    }
  });

  index = 0;
  for (index in this.combatants) {
    //Orders the tokens based on initiative
    this.combatants[index] = MML.getCharFromToken(getObj("graphic", turnorder[index].id));
  }

  Campaign().set("turnorder", JSON.stringify(turnorder));
};

MML.changeRoll = function changeRoll(input) {
  var value = input.value;
  var range = this.currentRoll.range.split("-");
  var low = parseInt(range[0]);
  var high = parseInt(range[1]);
  log(this.currentRoll.callback);
  if (value >= low && value <= high) {
    if (this.currentRoll.type === "damage") {
      this.currentRoll.value = -value;
      this.currentRoll.message = "Roll: " + value + "\nRange: " + this.currentRoll.range;
    } else {
      this.currentRoll.value = value;
      if (this.currentRoll.type === "universal") {
        this.currentRoll = MML.universalRollResult(this.currentRoll);
      } else if (this.currentRoll.type === "attribute") {
        this.currentRoll = MML.attributeCheckResult(this.currentRoll);
      } else if (this.currentRoll.type === "generic") {
        this.currentRoll = MML.genericRollResult(this.currentRoll);
      }
    }
  } else {
    sendChat("Error", "New roll value out of range.");
  }
  MML.processCommand({
    type: "character",
    who: this.currentRoll.character,
    callback: this.currentRoll.callback,
    input: {}
  });
};

MML.assignNewItem = function assignNewItem(input) {
  MML.processCommand({
    type: "character",
    who: input.target,
    callback: "setApiCharAttributeJSON",
    input: {
      attribute: "inventory",
      index: generateRowID(),
      value: state.MML.GM.newItem
    }
  });
};

// var exampleCommand = {
//   type: "player",
//   who: state.MML.players[playerName],
//   callback:"menuCommand",
//   input: {
//     rollResult: "Success"
//   }
// };

function commandLock() {
  switch (state.MML.GM.gameState) {
    case "non-combat":

      break;
    default:

  }
}

MML.processCommand = function processCommand(command) {
  try {
    switch (command.type) {
      case "character":
        var character = state.MML.characters[command.who];
        MML[command.callback].apply(character, [command.input]);
        state.MML.characters[command.who] = character;
        break;
      case "player":
        var player = state.MML.players[command.who];
        MML[command.callback].apply(player, [command.input]);
        state.MML.players[command.who] = player;
        break;
      case "GM":
        MML[command.callback].apply(state.MML.GM, [command.input]);
        break;
      default:
        break;
    }
  } catch (error) {
    sendChat("", "processCommand failed");
    // log(state.MML.GM);
    // log(state.MML.players);
    // log(state.MML.characters);
    log(MML[command.callback]);
    log(command);
    log(error.message);
    log(error.stack);
  }
};

MML.parseCommand = function parseCommand(msg) {
  var who;
  if (msg.type === "api" && msg.content.indexOf("!MML|") !== -1) {
    var command = "parse failed";
    var content = msg.content.replace("!MML|", "");
    who = msg.who.replace(" (GM)", "");
    var input;

    if (content.indexOf("selectTarget") !== -1) {
      var stringIn = content.replace("selectTarget ", "").split("|");
      var character = stringIn[0];
      var target = stringIn[1];
      var hexedInput = stringIn[2];

      input = MML.dehexify(hexedInput);

      try {
        input = JSON.parse(input);
      } catch (e) {
        command = "selectTarget parse failed";
        sendChat("", command);
        log(stringIn);
        log(input);
        MML.error();
      }
      input.target = target;

      command = {
        type: "player",
        who: who,
        callback: input.callback,
        input: input
      };
    } else if (content.indexOf("changeRoll") !== -1) {
      var value = parseInt(content.replace("changeRoll ", ""));

      if (!isNaN(value)) {
        command = {
          type: "player",
          who: state.MML.GM.player,
          callback: "changeRoll",
          input: {
            value: value
          }
        };
      } else {
        sendChat("Error", "Please enter a numerical value.");
      }
    } else if (content.indexOf("acceptRoll") !== -1) {
      if (state.MML.players[who].currentRoll.accepted === false) {
        var player = state.MML.players[who];
        state.MML.players[player.name].currentRoll.accepted = true;

        command = {
          type: "character",
          who: player.who,
          callback: player.currentRoll.callback,
          input: {}
        };
      }
    } else if (content.indexOf("displayItemOptions") !== -1) {
      input = content.replace("displayItemOptions ", "").split("|");
      who = input[0];
      var itemId = input[1];

      command = {
        type: "player",
        who: who,
        callback: "displayItemOptions",
        input: {
          who: who,
          itemId: itemId
        }
      };
    } else {
      command = MML.dehexify(content);
      try {
        command = JSON.parse(command);
      } catch (e) {
        log(command);
        log(content);
        sendChat("", "JSON parse failed");
      }

      command.input.selectedCharNames = MML.getSelectedCharNames(msg.selected);
    }
    if (state.MML.commandRecorder) {
      state.MML.commandArray.push(command);
    }
    MML.processCommand(command);
  }
};
