/* jshint -W069 */
//Combat Functions
MML.displayMovement = function displayMovement(input) {
    if (input.display) {
        MML.getTokenFromChar(this.name).set("aura1_radius", MML.movementRates[this.race][this.movementPosition] * this.movementAvailable);
        MML.getTokenFromChar(this.name).set("aura1_color", "#00FF00");
    } else {
        MML.getTokenFromChar(this.name).set("aura1_color", "transparent");
    }
};

MML.moveDistance = function moveDistance(distance) {
    this.movementAvailable -= (distance) / (MML.movementRates[this.race][this.movementPosition]);
    MML.displayMovement.apply(this, [true]);
};

MML.newRoundUpdateCharacter = function newRoundUpdateCharacter(input) {
    if (_.has(this.statusEffects, "Melee This Round")) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "setApiCharAttribute",
            input: {
                attribute: "roundsExertion",
                value: this.roundsExertion + 1
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "setApiCharAttribute",
            input: {
                attribute: "roundsRest",
                value: 0
            }
        });

        if (this.fatigueLevel < 1) {
            if (this.roundsExertion > this.fitness) {
                MML.processCommand({
                    type: "character",
                    who: this.name,
                    callback: "fatigueCheckRoll",
                    input: {
                        modifier: 0
                    }
                });
            }
        } else {
            if (this.roundsExertion > Math.round(this.fitness / 2)) {
                MML.processCommand({
                    type: "character",
                    who: this.name,
                    callback: "fatigueCheckRoll",
                    input: {
                        modifier: -4
                    }
                });
            }
        }
    } else if (this.fatigueLevel > 0) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "setApiCharAttribute",
            input: {
                attribute: "roundsRest",
                value: this.roundsRest + 1
            }
        });

        if (this.roundsRest >= 6) {
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "fatigueRecoveryRoll",
                input: {
                    modifier: 0
                }
            });
        }
    }

    // Reset knockdown number
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "knockdown",
            value: this.knockdownMax
        }
    });
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "spentInitiative",
            value: 0
        }
    });
    this.action = {};

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "ready",
            value: false
        }
    });
};

MML.setReady = function setReady(ready) {
    if (state.MML.GM.inCombat === true && this.ready === "false") {
        MML.getTokenFromChar(this.name).set("tint_color", "#FF0000");
    } else {
        MML.getTokenFromChar(this.name).set("tint_color", "transparent");
    }
    return this.ready;
};

// Health and Wounds
MML.alterHP = function alterHP(position, hpAmount) {
    var woundInfo = {
        bodyPart: MML.hitPositions[position].part,
        type: "none",
        duration: -1
    };

    if (hpAmount < 0) { //if damage
        var initialHP = this[woundInfo.bodyPart].current;
        var currentHP = initialHP + hpAmount;
        this[woundInfo.bodyPart].current = currentHP;
        //Wounds
        if (currentHP < Math.round(this[woundInfo.bodyPart].max / 2) && currentHP >= 0) { //Major wound
            woundInfo.type = "major";
            if (initialHP >= Math.round(this[woundInfo.bodyPart].max / 2) && this[woundInfo.bodyPart].wound.major === {}) { //Fresh wound
                woundInfo.duration = Math.round(this[woundInfo.bodyPart].max / 2) - currentHP;
            } else { //Add damage to duration of effect
                woundInfo.duration = -hpAmount;
            }
        } else if (currentHP < 0 && currentHP > -this[woundInfo.bodyPart].max) { //Disabling wound
            if (this[woundInfo.bodyPart].wound.disabling === {}) { //Fresh wound
                woundInfo.type = "disabling";
                woundInfo.duration = -currentHP;

            } else { //Add damage to duration of effect
                woundInfo.type = "disabling";
                woundInfo.duration = -hpAmount;
            }

        } else if (currentHP < -this[woundInfo.bodyPart].max) { //Mortal wound
            woundInfo.type = "mortal";
        }
    } else { //if healing
        this[woundInfo.bodyPart].current += hpAmount;

        if (this[woundInfo.bodyPart].current >= -1 * this[woundInfo.bodyPart].max) {
            this[woundInfo.bodyPart].wound.mortal = false;
        }
        if (this[woundInfo.bodyPart].current >= 0) {
            this[woundInfo.bodyPart].wound.disabling = false;
        }
        if (this[woundInfo.bodyPart].current >= Math.round(this[woundInfo.bodyPart].max / 2)) {
            this[woundInfo.bodyPart].wound.major = {};
        }
        if (this[woundInfo.bodyPart].current > this[woundInfo.bodyPart].max) {
            this[woundInfo.bodyPart].current = this[woundInfo.bodyPart].max;
        }
    }
    return woundInfo;
};

MML.setMultiWound = function setMultiWound() {
    var currentHP = this.hp;
    currentHP.multiWound = this.hpMax.multiwound;

    _.each(MML.getBodyParts(this), function(bodyPart) {
        if (currentHP[bodyPart] >= Math.round(this.hpMax[bodyPart] / 2)) { //Only minor wounds apply
            currentHP.multiWound -= this.hpMax[bodyPart] - currentHP[bodyPart];
        } else {
            currentHP.multiWound -= this.hpMax[bodyPart] - Math.round(this.hpMax[bodyPart] / 2);
        }
    });

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "hp",
            value: currentHP
        }
    });

    if (!_.has(this.statusEffects, "Wound Fatigue")) {
        MML.multiWoundRoll();
    }
};

MML.multiWoundRoll = function getMultiWoundRoll(input) {
    var roll = attributeCheckRoll("systemStrength", [0]);
};

MML.multiWoundRollResult = function getMultiWoundRoll(input) {
    var roll = attributeCheckRoll("systemStrength", [0]);
};

MML.multiWoundRoll = function getMultiWoundRoll(input) {
    var roll = attributeCheckRoll("systemStrength", [0]);
};

MML.majorWoundRoll = function majorWoundRoll(input) {
    roll = this.attributeCheckRoll("willpower", [0]);
};

MML.majorWoundRollResult = function majorWoundRollResult(input) {
    var roll;

};

MML.majorWoundRollApply = function majorWoundRollApply() {
    if (this.rolls.result === "Failure") {
        var message = this.name + " suffered a major wound to their " + bodyPart;
        this.characters[this.currentTarget][this.rolls.wound.bodyPart].wound.major.duration += this.rolls.wound.duration;
    }
};

MML.disablingWoundRoll = function disablingWoundRoll(input) {
    roll = this.attributeCheckRoll("systemStrength", [0]);
};

MML.disablingWoundRollResult = function disablingWoundRollResult(woundInfo) {};

MML.disablingWoundRollApply = function disablingWoundRollApply() {
    this.characters[this.currentTarget][this.rolls.wound.bodyPart].wound.disabling = true;

    if (this.rolls.wound.result === "Failure") {
        this.characters[this.currentTarget].stun.duration += this.rolls.wound.duration;
    }
};

MML.mortalWoundRoll = function mortalWoundRoll(input) {
    var roll = this.attributeCheckRoll("systemStrength", [0]);
};

MML.mortalWoundRollResult = function mortalWoundRollResult(woundInfo) {
    var roll;
};

MML.mortalWoundRollApply = function mortalWoundRollApply() {};

MML.checkKnockdown = function checkKnockdown(damage) {
    if (this.movementPosition !== "Prone") {
        this.knockdown += damage;
        this.updateCharacter("knockdown");
    }
};

MML.knockdownRoll = function knockdownRoll() {
    var roll;

    if (_.has(this.statusEffects, "Stumbling")) {
        //victim saved first knockdown check, harder to save 2nd time
        roll = MML.attributeCheckRoll(this, ["systemStrength", [-5]]);
    } else {
        roll = MML.attributeCheckRoll(this, ["systemStrength", [0]]);
    }
    return roll;
};

MML.getKnockdownRoll = function getKnockdownRoll(input) {
    switch (input) {
        case "entry":
            if (this.characters[this.currentTarget].checkKnockdown()) {
                this.displayMenu(this.characters[this.currentTarget].name, ["Roll Knockdown"]);
            } else {
                this.rollIndex = "getSensitiveAreaRoll";
                this.menu = MML.performAction;
                this.menu();
            }
            break;
        case "Roll Knockdown":
            this.currentRoll = this.characters[this.currentTarget].knockdownRoll();
            this.displayRoll();
            break;
        case "result":
            this.rolls.knockdown = this.currentRoll.result;
            if (this.rolls.knockdown === "Critical Success" || this.rolls.knockdown === "Success") {
                this.stumble = 1;
            } else {
                sendChat("Game", this.characters[this.currentTarget].name + " is knocked to the ground");
                this.characters[this.currentTarget].currentMotion = "prone";
                this.characters[this.currentTarget].knockdown.current = this.characters[this.currentTarget].knockdown.max;
            }
            this.rollIndex = "getSensitiveAreaRoll";
            this.menu = MML.performAction;
            this.menu();
            break;
        default:
            break;
    }
};

MML.sensitiveAreaRoll = function sensitiveAreaCheck() {
    var roll = this.attributeCheckRoll("willpower", [0]);
    return roll;
};

MML.getSensitiveAreaRoll = function getSensitiveAreaRoll(input) {
    switch (input) {
        case "entry":
            if (this.characters[this.currentTarget].isSensitiveArea(this.rolls.hitPosition)) {
                this.displayMenu(this.characters[this.currentTarget].name + " was hit in a sensitive area.", ["Sensitive Area Roll"]);
            } else {
                this.rollIndex = "getWoundRoll";
                this.menu = MML.performAction;
                this.menu();
            }
            break;
        case "Sensitive Area Roll":
            this.currentRoll = this.characters[this.currentTarget].sensitiveAreaRoll();
            this.displayRoll();
            break;
        case "result":
            this.rolls.sensitiveArea = this.currentRoll.result;
            if (this.rolls.sensitiveArea !== "Critical Success" || this.rolls.sensitiveArea !== "Success") {
                sendChat("", this.characters[this.currentTarget].name + " is in pain!");
                this.characters[this.currentTarget].sensitive = 1;
            }
            this.rollIndex = "getWoundRoll";
            this.menu = MML.performAction;
            this.menu();
            break;
        default:
            break;
    }
};

MML.fatigueCheckRoll = function fatigueCheckRoll(modifier) {
    if (MML.attributeCheckRoll(charName, "fitness", [modifier])) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "setApiCharAttribute",
            input: {
                attribute: "fatigueLevel",
                value: this.fatigueLevel + 1
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "setApiCharAttribute",
            input: {
                attribute: "roundsExertion",
                value: 0
            }
        });
    }
};

MML.fatigueRecoveryRoll = function fatigueRecoveryRoll(modifier) {
    this.attributeCheckRoll("health", [modifier]);
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "roundsRest",
            value: 0
        }
    });
    this.fatigueLevel--;
    this.updateCharacter("fatigueLevel");
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "fatigueLevel",
            value: this.fatigueLevel - 1
        }
    });
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "roundsExertion",
            value: 0
        }
    });
};

MML.armorDamageReduction = function armorDamageReduction(position, damage, type, coverageRoll) {
    var damageApplied = false; //Accounts for partial coverage, once true the loop stops
    var damageDeflected = 0;

    // Iterates over apv values at given position (accounting for partial coverage)
    var apv;
    for (apv in this.apv[position][type]) {
        if (damageApplied === false) {
            if (coverageRoll <= this.apv[position][type][apv].coverage) { //if coverage roll is less than apv coverage
                damageDeflected = this.apv[position][type][apv];

                //If all damage is deflected, do blunt trauma. Modifies damage variable for next if statement
                if (damage + damageDeflected >= 0) {
                    //If surface, cut, or pierce, cut in half and apply as impact
                    if (type === "Surface" || type === "Cut" || type === "Pierce") {
                        damage = Math.ceil(damage / 2);
                        damageDeflected = this.apv[position].Impact[apv];

                        if (damage + damageDeflected >= 0) {
                            damageDeflected = -damage;
                            damage = 0;
                        }
                    }
                    //If chop, or thrust, apply 3/4 as impact
                    else if (type === "Chop" || type === "Thrust") {
                        damage = Math.ceil(damage * 0.75);
                        damageDeflected = this.apv[position].Impact[apv];

                        if (damage + damageDeflected >= 0) {
                            damageDeflected = -damage;
                            damage = 0;
                        }
                    }
                    //If impact or flanged, no damage
                    else {
                        damageDeflected = -damage;
                        damage = 0;
                    }
                }

                // if damage gets through, subtract amount deflected by armor
                if (damage < 0) {
                    damage += damageDeflected;
                }
                damageApplied = true;
            }
        }
    }
    return damage;
};

MML.initiativeRoll = function initiativeRoll(input) {
    var rollValue = MML.rollDice(1, 10);

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "updateCharacter",
        input: {
            attribute: "action"
        }
    });
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "ready",
            value: true
        }
    });

    MML.processCommand({
        type: "player",
        who: this.player,
        callback: "setApiPlayerAttribute",
        input: {
            attribute: "currentRoll",
            value: {
                character: this.name,
                name: "initiative",
                value: rollValue,
                callback: "initiativeResult",
                range: "1-10",
                accepted: false
            }
        }
    });

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "initiativeResult",
        input: {}
    });
};

MML.initiativeResult = function initiativeResult(input) {
    var currentRoll = state.MML.players[this.player].currentRoll;

    currentRoll.rollResult =
        currentRoll.value +
        this.situationalInitBonus +
        this.movementRatioInitBonus +
        this.attributeInitBonus +
        this.senseInitBonus +
        this.fomInitBonus +
        this.firstActionInitBonus +
        this.spentInitiative;

    currentRoll.message =
        "Roll: " + currentRoll.value +
        "\nResult: " + currentRoll.rollResult +
        "\nRange: " + currentRoll.range;

    if (this.player === state.MML.GM.player) {
        if (currentRoll.accepted === false) {
            MML.processCommand({
                type: "player",
                who: this.player,
                callback: "displayGmRoll",
                input: {
                    currentRoll: currentRoll
                }
            });
        } else {
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "initiativeApply",
                input: {}
            });
        }
    } else {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayPlayerRoll",
            input: {
                currentRoll: currentRoll
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "initiativeApply",
            input: {}
        });
    }
};

MML.initiativeApply = function initiativeApply() {
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "setApiCharAttribute",
        input: {
            attribute: "initiativeRoll",
            value: state.MML.players[this.player].currentRoll.value
        }
    });

    MML.processCommand({
        type: "player",
        who: this.player,
        callback: "prepareNextCharacter",
        input: {}
    });
};

MML.startAction = function startAction(input) {
    state.MML.GM.currentAction = {
        who: this.name
    };

    if (!_.isUndefined(this.action.getTargets)) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: this.action.getTargets,
            input: {}
        });
    } else {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: this.action.callback,
            input: {}
        });
    }
};

MML.startAttackAction = function startAttackAction(input) {
    if (_.has(this.statusEffects, "Called Shot")) {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "charMenuSelectBodyPart",
            input: {
                who: this.name,
            }
        });
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayMenu",
            input: {}
        });
    } else if (_.has(this.statusEffects, "Called Shot Specific")) {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "charMenuSelectHitPosition",
            input: {
                who: this.name,
            }
        });
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayMenu",
            input: {}
        });
    } else if (_.contains(this.action.modifiers, ["Aim"])) {
        if (_.has(this.statusEffects, "Taking Aim")) {
            this.statusEffects["Taking Aim"].level++;
        } else {
            this.statusEffects["Taking Aim"] = {
                name: "Taking Aim",
                level: 1,
                target: input.target
            };
        }
    } else {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "processAttack",
            input: {}
        });
    }
};

MML.processAttack = function processAttack(input) {
    this.statusEffects["Melee This Round"] = {};

    if (MML.isUnarmed(this)) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "unarmedAttack",
            input: {}
        });
    } else if (MML.isDualWielding(this)) {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "dualWieldAttack",
            input: {}
        });
    } else if (MML.getWeaponFamily(this, "leftHand") === "MWD" || MML.getWeaponFamily(this, "leftHand") === "MWM") {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "missileAttack",
            input: {}
        });
    } else if (MML.getWeaponFamily(this, "leftHand") === "TWH" ||
        MML.getWeaponFamily(this, "rightHand") === "TWH" ||
        MML.getWeaponFamily(this, "leftHand") === "TWK" ||
        MML.getWeaponFamily(this, "rightHand") === "TWK" ||
        MML.getWeaponFamily(this, "leftHand") === "TWS" ||
        MML.getWeaponFamily(this, "rightHand") === "TWS" ||
        MML.getWeaponFamily(this, "leftHand") === "SLI" ||
        MML.getWeaponFamily(this, "rightHand") === "SLI") {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "throwingAttack",
            input: {}
        });
    } else {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "meleeAttack",
            input: {}
        });
    }
};

MML.meleeAttack = function meleeAttack(input) {
    var itemId;
    var grip;

    if (MML.getWeaponFamily(this, "rightHand") !== "unarmed") {
        itemId = this.rightHand._id;
        grip = this.rightHand.grip;
    } else {
        itemId = this.leftHand._id;
        grip = this.leftHand.grip;
    }
    var item = this.inventory[itemId];
    var attackerWeapon = {
        _id: itemId,
        name: item.name,
        type: "weapon",
        weight: item.weight,
        family: item.grips[grip].family,
        hands: item.grips[grip].hands,
        defense: item.grips[grip].defense,
        initiative: item.grips[grip].initiative,
        rank: item.grips[grip].rank
    };

    if (this.action.weaponType === "primary") {
        attackerWeapon.damageType = item.grips[grip].primaryType;
        attackerWeapon.task = item.grips[grip].primaryTask;
        attackerWeapon.damage = item.grips[grip].primaryDamage;
    } else {
        attackerWeapon.damageType = item.grips[grip].secondaryType;
        attackerWeapon.task = item.grips[grip].secondaryTask;
        attackerWeapon.damage = item.grips[grip].secondaryDamage;
    }

    var currentAction = {
        character: this,
        callback: "meleeAttackAction",
        parameters: {
            attackerWeapon: attackerWeapon,
            attackerSkill: MML.getWeaponSkill(this, this.inventory[itemId]),
            target: state.MML.characters[state.MML.GM.currentAction.targetArray[0]]
        },
        rolls: {}
    };

    state.MML.GM.currentAction = _.extend(state.MML.GM.currentAction, currentAction);
    MML[currentAction.callback]();
};

MML.meleeAttackRoll = function meleeAttackRoll(rollName, character, task, skill) {
    MML.processCommand({
        type: "character",
        who: character.name,
        callback: "universalRoll",
        input: {
            name: rollName,
            callback: "attackRollResult",
            mods: [task, skill, character.situationalMod, character.meleeAttackMod, character.attributeMeleeAttackMod]
        }
    });
};

MML.attackRollResult = function attackRollResult(input) {
    var currentRoll = state.MML.players[this.player].currentRoll;

    if (this.player === state.MML.GM.player) {
        if (currentRoll.accepted === false) {
            MML.processCommand({
                type: "player",
                who: this.player,
                callback: "displayGmRoll",
                input: {
                    currentRoll: currentRoll
                }
            });
        } else {
            if (_.contains(this.action.modifiers, ["Called Shot Specific"]) && currentRoll.value - currentRoll.target < 11) {
                this.action.modifiers = _.without(this.action.modifiers, 'Called Shot Specific');
                this.action.modifiers.push("Called Shot");
                currentRoll.result = "Success";
            }
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "attackRollApply",
                input: {}
            });
        }
    } else {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayPlayerRoll",
            input: {
                currentRoll: currentRoll
            }
        });
        if (_.contains(this.action.modifiers, ["Called Shot Specific"]) && currentRoll.value - currentRoll.target < 11) {
            this.action.modifiers = _.without(this.action.modifiers, 'Called Shot Specific');
            this.action.modifiers.push("Called Shot");
            currentRoll.result = "Success";
        }
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "attackRollApply",
            input: {}
        });
    }
};

MML.attackRollApply = function attackRollApply(input) {
    state.MML.GM.currentAction.attackRoll = state.MML.players[this.player].currentRoll.result;
    MML[state.MML.GM.currentAction.callback]();
};

MML.hitPositionRoll = function hitPositionRoll(input) {
    var rollValue;
    var range;
    var result;
    var action = state.MML.GM.currentAction;
    var target = state.MML.characters[action.targetArray[action.targetIndex]];

    if (_.has(this.statusEffects, "Called Shot Specific")) {
        rollValue = +_.findKey(MML.hitPositions[target.bodyType], function(hitPosition) {
            return hitPosition.name === action.calledShot;
        });
        range = rollValue + "-" + rollValue;
        result = MML.hitPositions[target.bodyType][rollValue];
    } else if (_.has(this.statusEffects, "Called Shot")) {
        var rangeUpper = MML.getAvailableHitPositions(target, action.calledShot).length;
        rollValue = MML.rollDice(1, rangeUpper);
        range = "1-" + rangeUpper;
        result = MML.getCalledShotHitPosition(target, rollValue, action.calledShot);
    } else {
        range = "1-" + _.keys(MML.hitPositions[target.bodyType]).length;
        result = MML.getHitPosition(target, MML.rollDice(1, 100));
        rollValue = +_.findKey(MML.hitPositions[target.bodyType], function(hitPosition) {
            return hitPosition.name === result.name;
        });
    }

    MML.processCommand({
        type: "player",
        who: this.player,
        callback: "setApiPlayerAttribute",
        input: {
            attribute: "currentRoll",
            value: {
                type: "hitPosition",
                character: this.name,
                player: this.player,
                callback: "hitPositionRollResult",
                range: range,
                result: result,
                value: rollValue,
                accepted: false
            }
        }
    });

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "hitPositionRollResult",
        input: {}
    });
};

MML.hitPositionRollResult = function hitPositionRollResult(input) {
    var currentRoll = state.MML.players[this.player].currentRoll;
    var action = state.MML.GM.currentAction;
    var target = state.MML.characters[action.targetArray[action.targetIndex]];

    if (_.has(this.statusEffects, "Called Shot")) {
        currentRoll.result = MML.getCalledShotHitPosition(target, currentRoll.value, action.calledShot);
    } else {
        currentRoll.result = MML.hitPositions[target.bodyType][currentRoll.value];
    }

    currentRoll.message = "Roll: " + currentRoll.value +
        "\nResult: " + currentRoll.result.name +
        "\nRange: " + currentRoll.range;

    if (this.player === state.MML.GM.player) {
        if (currentRoll.accepted === false) {
            MML.processCommand({
                type: "player",
                who: this.player,
                callback: "displayGmRoll",
                input: {
                    currentRoll: currentRoll
                }
            });
        } else {
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "hitPositionRollApply",
                input: currentRoll
            });
        }
    } else {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayPlayerRoll",
            input: {
                currentRoll: currentRoll
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "hitPositionRollApply",
            input: {
                result: currentRoll.result
            }
        });
    }
};

MML.hitPositionRollApply = function hitPositionRollApply(input) {
    state.MML.GM.currentAction.hitPosition = input.result;

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: input.callback,
        input: {}
    });
};

MML.meleeDefense = function meleeDefense(defender, attackerWeapon) {
    var weaponId;
    var shieldId;
    var grip;
    var skill;
    var defenderWeapon;
    var dodgeChance;
    var blockChance;
    var defaultMartialSkill = defender.weaponSkills["Default Martial"].level;
    var shieldMod = MML.getShieldDefenseBonus(defender);
    var defenseMod = defender.meleeDefenseMod + defender.attributeDefenseMod;
    var sitMod = defender.situationalMod;

    defender.statusEffects["Melee This Round"] = {};

    if (!_.isUndefined(defender.skills["Dodge"]) && defender.skills["Dodge"].level >= defaultMartialSkill) {
        dodgeChance = defender.weaponSkills["Dodge"].level + defenseMod + sitMod;
    } else {
        dodgeChance = defaultMartialSkill + defenseMod + sitMod;
    }

    if (attackerWeapon.initiative < 6) {
        dodgeChance += 15;
    }

    if (MML.isDualWielding(defender)) {
        log("Dual Wield defense");
    } else if (MML.isUnarmed(defender) || MML.isWieldingRangedWeapon(defender)) {
        blockChance = 0;
    } else if (MML.getWeaponFamily(defender, "rightHand") !== "unarmed") {
        itemId = defender.rightHand._id;
        grip = defender.rightHand.grip;
    } else {
        itemId = defender.leftHand._id;
        grip = defender.leftHand.grip;
    }

    defenderWeapon = defender.inventory[itemId];
    defenderSkill = Math.round(MML.getWeaponSkill(defender, defenderWeapon) / 2);

    MML.processCommand({
        type: "player",
        who: defender.player,
        callback: "charMenuDefenseRoll",
        input: {
            defenderWeapon: defenderWeapon,
            defenderGrip: grip,
            defenderSkill: defenderSkill,
            who: defender.name,
            dodgeChance: dodgeChance,
            blockChance: defenderWeapon.grips[grip].defense + defaultMartialSkill + sitMod + defenseMod + shieldMod
        }
    });
    MML.processCommand({
        type: "player",
        who: defender.player,
        callback: "displayMenu",
        input: {}
    });
};

MML.meleeBlockRoll = function meleeBlockRoll(input) {
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "universalRoll",
        input: {
            callback: "meleeBlockRollResult",
            mods: [input.blockChance]
        }
    });
};

MML.meleeBlockRollResult = function meleeBlockRollResult(input) {
    var currentRoll = state.MML.players[this.player].currentRoll;

    if (this.player === state.MML.GM.player) {
        if (currentRoll.accepted === false) {
            MML.processCommand({
                type: "player",
                who: this.player,
                callback: "displayGmRoll",
                input: {
                    currentRoll: currentRoll
                }
            });
        } else {
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "meleeBlockRollApply",
                input: currentRoll
            });
        }
    } else {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayPlayerRoll",
            input: {
                currentRoll: currentRoll
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "meleeBlockRollApply",
            input: currentRoll
        });
    }
};

MML.meleeBlockRollApply = function meleeBlockRollApply(input) {
    var result = state.MML.players[this.player].currentRoll.result;

    if (result === "Success") {
        if (_.has("Number of Defenses")) {
            this.statusEffects["Number of Defenses"].number++;
        } else {
            this.statusEffects["Number of Defenses"] = {
                number: 1
            };
        }
    } else if (result === "Critical Success") {
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "criticalDefense",
            input: {}
        });
    }

    state.MML.GM.currentAction.defenseRoll = result;
    MML[state.MML.GM.currentAction.callback]();
};

MML.meleeDodgeRoll = function meleeDodgeRoll(input) {
    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "universalRoll",
        input: {
            callback: "meleeDodgeRollResult",
            mods: [input.dodgeChance]
        }
    });
};

MML.equipmentFailure = function equipmentFailure(input) {
    log("equipmentFailure");
};

MML.meleeDamageRoll = function meleeDamageRoll(character, attackerWeapon, crit, bonusDamage) {
    bonusDamage = 0;

    MML.processCommand({
        type: "character",
        who: this.name,
        callback: "rollDamage",
        input: {
            callback: "meleeDamageResult",
            crit: crit,
            damageDice: attackerWeapon.damage,
            damageType: attackerWeapon.damageType,
            mods: [this.meleeDamageMod, bonusDamage]
        }
    });
};

MML.meleeDamageResult = function meleeDamageResult(input) {
    var currentRoll = state.MML.players[this.player].currentRoll;

    if (this.player === state.MML.GM.player) {
        if (currentRoll.accepted === false) {
            MML.processCommand({
                type: "player",
                who: this.player,
                callback: "displayGmRoll",
                input: {
                    currentRoll: currentRoll
                }
            });
        } else {
            MML.processCommand({
                type: "character",
                who: this.name,
                callback: "meleeDamageRollApply",
                input: currentRoll
            });
        }
    } else {
        MML.processCommand({
            type: "player",
            who: this.player,
            callback: "displayPlayerRoll",
            input: {
                currentRoll: currentRoll
            }
        });
        MML.processCommand({
            type: "character",
            who: this.name,
            callback: "meleeDamageRollApply",
            input: currentRoll
        });
    }
};

MML.meleeDamageRollApply = function meleeDamageRollApply(input) {
    var result = state.MML.players[this.player].currentRoll.result;
    state.MML.GM.currentAction.damageRoll = result;

    MML.alterHP(MML.armorDamageReduction(state.MML.GM.currentAction.hitPositionRoll.bodyPart, result.value, type, rollDice(1, 100)))
    state.MML.GM.currentAction.callback
};

// Todo: Add sweep attack

// // Check if missle weapon and maybe magic
// MML.defenseRoll = function defenseRoll(){
//  var roll = {};
//  var weapon = this.inventory.weapons[0];
//     var weaponSkill = Math.round(this.skills[weapon.name]/2);
//  var shieldMod = this.inventory.shield.defenseMod;
//  var dodgeSkill = this.skills.dodge;
//  var defaultMartialSkill = this.skills.defaultMartial;
//  var defenseMod = this.modifiers.defense;
//     var sitMod = this.modifiers.situational;
//  var dodgeChance;
//  var blockChance;

//  if(weaponSkill >= defaultMartialSkill){
//      blockChance = weapon.defense + weaponSkill + sitMod + defenseMod + shieldMod;
//  }
//  else{
//      blockChance = weapon.defense + defaultMartialSkill + sitMod + defenseMod + shieldMod;
//  }

//  if(dodgeSkill >= defaultMartialSkill){
//      dodgeChance = dodgeSkill + sitMod + defenseMod;
//  }
//  else{
//      dodgeChance = defaultMartialSkill + sitMod + defenseMod;
//  }

//  switch(this.defense.style){
//      case "Block":
//          this.defense.number++;
//          roll = this.universalRoll([blockChance]);
//      break;
//      case "Dodge":
//          this.defense.number++;
//          this.defense.dodge = true;
//          roll = this.universalRoll([dodgeChance]);
//      break;
//      case "Take It":
//          roll = {value: 100, player: this.player, result: "Failure", target: 1};
//      break;
//      default:
//      break;
//  }

//  return roll;
// };

// MML.missileAttack = function missileAttack(){
//  var weapon = this.inventory.weapons[0];
//  var skill = this.action.skill;
//  var attackMod = this.modifiers.attack;
//  var attackerSitMod = this.modifiers.situational;
//  // var range = MML.getDistanceBetweenChars(this.name, this.);
//  var task;
//  //var damageDice;

//  // Get task and damage from range
//  if ( range <= attackerWeapon.range.pointBlank.range ){
//      task = attackerWeapon.range.pointBlank.task;
//      //damageDice = attackerWeapon.range.pointBlank.damage;
//  }
//  else if ( range <= attackerWeapon.range.effective.range ){
//      task = attackerWeapon.range.effective.task;
//      //damageDice = attackerWeapon.range.effective.damage;
//  }
//  else if ( range <= attackerWeapon.range.long.range ){
//      task = attackerWeapon.range.long.task;
//      //damageDice = attackerWeapon.range.long.damage;
//  }
//  else {
//      task = attackerWeapon.range.extreme.task;
//      //damageDice = attackerWeapon.range.extreme.damage;
//  }

//  // // Determine dodge or shield
//  // if (defenderDodgeSkill > (defaultMartialSkill + shieldDefenseMod)){
//      // defenderSkill = defenderDodgeSkill;
//  // }
//  // else {
//      // defenderSkill = defaultMartialSkill + shieldDefenseMod;
//  // }

//  //var position = MML.rollHitPosition(state.MML.characters[charName].action.elevation, defender, target);
//  state.MML.Combat.turnInfo.currentRoll = this.universalRoll([task, skill, attackerSitMod, attackMod]);

// };

MML.unarmedAttack = function unarmedAttack(charName) {};

MML.readyItemAction = function readyItemAction(charName) {};

MML.castSpellAction = function castSpellAction(charName) {};

MML.observeAction = function observeAction(charName) {};
