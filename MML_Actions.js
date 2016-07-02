MML.meleeAttackAction = function meleeAttackAction(){
    var currentAction = state.MML.GM.currentAction;
    var character = currentAction.character;
    var parameters = currentAction.parameters;
    var attackerSkill = parameters.attackerSkill;
    var attackerWeapon = parameters.attackerWeapon;
    var target = parameters.target;
    var targetWeapon = parameters.targetWeapon;
    var defenseSkill = parameters.defenseSkill;
    var dodgeSkill = parameters.dodgeSkill;
    var rolls = currentAction.rolls;

    if(_.isUndefined(rolls.attackRoll)){
        MML.meleeAttackRoll("attackRoll", character, attackerWeapon.task, attackerSkill);
    }
    else if(_.isUndefined(rolls.defenseRoll)){
        if (rolls.attackRoll === "Critical Success" || rolls.attackRoll === "Success") {
            MML.meleeDefenseRoll(target, targetWeapon);
        }
        else if (rolls.attackRoll === "Critical Failure"){
            MML.endAction();
        }
        else {
            MML.endAction();
        }
    }
    else if(_.isUndefined(rolls.hitPositionRoll)){
        if (rolls.defenseRoll === "Critical Success" || rolls.defenseRoll === "Success") {
            MML.endAction(target, targetWeapon);
        }
        else if (rolls.defenseRoll === "Critical Failure"){
            MML.hitPositionRoll();
        }
        else {
            MML.hitPositionRoll();
        }
    }
    else if(_.isUndefined(rolls.damageRoll)){
        if (rolls.attackRoll === "Critical Success") {
            MML.meleeDamageRoll(character, attackerWeapon, true);
        }
        else {
            MML.meleeDamageRoll(character, attackerWeapon, false);
        }
    }
    else if(!_.isUndefined(parameters.wound)){
        MML.woundRoll();
    }
    else if(!_.isUndefined(parameters.multiWound)){
        MML.multiWoundRoll();
    }
    else if(!_.isUndefined(parameters.sensitiveArea)){
        MML.sensitiveAreaRoll();
    }
    else if(!_.isUndefined(parameters.knockDown)){
        MML.knockdownRoll();
    }
    else {
      MML.endAction();
    }
};
