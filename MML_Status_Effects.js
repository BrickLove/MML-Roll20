/* jshint -W069 */
MML.statusEffects = {};
MML.statusEffects["Major Wound"] = function(effect, index){
    if(this[effect.bodyPart] > Math.round(this[effect.bodyPart + "Max"]/2)){
        delete this.statusEffects[index];
    }
    else{
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
        if(effect.duration > 0){
            this.situationalMod += -10;
        }
    }
};
MML.statusEffects["Disabling Wound"] = function(effect, index){
    if(this[effect.bodyPart] > 0){
        delete this.statusEffects[index];
    }
    else{
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -10;
        }
        this.situationalMod += -25;
    }
};
MML.statusEffects["Mortal Wound"] = function(effect, index){
    if(this[effect.bodyPart] <= -this[effect.bodyPart + "Max"]){
        delete this.statusEffects[index];
    }
    else{
        this.situationalInitBonus = "No Combat";
    }
};
MML.statusEffects["Wound Fatigue"] = function(effect, index){
    if(this.situationalInitBonus !== "No Combat"){
        this.situationalInitBonus += -5;
    }
    this.situationalMod  += -10;
};
MML.statusEffects["Number of Defenses"] = function(effect, index){
    if(state.GM.roundStarted === false){
        delete this.statusEffects[index];
    }

    this.missileDefenseMod += -20 * effect.number;
    this.meleeDefenseMod += -20 * effect.number;
};
MML.statusEffects["Fatigue"] = function(effect, index){
    if(this.situationalInitBonus !== "No Combat"){
        this.situationalInitBonus += -5*effect.level;
    }
    this.situationalMod  += -10*effect.level;
};
MML.statusEffects["Sensitive Area"] = function(effect, index){
    if(state.GM.roundStarted === false){
        effect.duration--;
        if(effect.duration < 1){
            delete this.statusEffects[index];
        }
    }
    else{
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
    }
    if(effect.duration > 1){
        this.situationalMod  += -10;
    }
};
MML.statusEffects["Stumbling"] = function(effect, index){
    if(state.GM.roundStarted === false){
        effect.duration--;
        if(effect.duration < 1){
            delete this.statusEffects[index];
        }
    }
    else{
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
    }
};
MML.statusEffects["Called Shot"] = function(effect, index){
    if(!_.contains(this.action.modifiers, "Called Shot")){
        delete this.statusEffects[index];
    }

    else{
        this.missileDefenseMod += -10;
        this.meleeDefenseMod += -10;
        this.missileAttackMod += -10;
        this.meleeAttackMod += -10;
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
    }
};
MML.statusEffects["Called Shot Specific"] = function(effect, index){
    if(!_.contains(this.action.modifiers, "Called Shot Specific")){
        delete this.statusEffects[index];
    }
    else{
        this.missileDefenseMod += -30;
        this.meleeDefenseMod += -30;
        this.meleeAttackMod += -30;
        this.missileAttackMod += -30;
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
    }
};
MML.statusEffects["Aggressive Stance"] = function(effect, index){
    if(!_.contains(this.action.modifiers, "Aggressive Stance")){
        // log("aggro deleted");
        delete this.statusEffects[index];
        // log(this.statusEffects);
    }
    else{
        this.missileDefenseMod += -40;
        this.meleeDefenseMod += -40;
        this.meleeAttackMod += 10;
        this.perceptionCheckMod += -4;
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += 5;
        }
    }
};
MML.statusEffects["Defensive Stance"] = function(effect, index){
    if(!_.contains(this.action.modifiers, "Defensive Stance")){
        delete this.statusEffects[index];
    }
    else{
        this.missileDefenseMod += 40;
        this.meleeDefenseMod += 40;
        this.meleeAttackMod += -30;
        this.perceptionCheckMod += -4;
        if(this.situationalInitBonus !== "No Combat"){
            this.situationalInitBonus += -5;
        }
    }
};
MML.statusEffects["Observe"] = function(effect, index){
    if(state.GM.roundStarted === false){
        effect.duration--;
    }

    if(effect.duration < 1 || (this.situationalInitBonus !== "No Combat" && !_.has(this.statusEffects, "Number of Defenses"))){
        delete this.statusEffects[index];
    }
    else if(effect.duration < 1){
        // Observing this round
        this.perceptionCheckMod += 4;
        this.missileDefenseMod += -10;
        this.meleeDefenseMod += -10;
    }
    else{
        //observed previous round
        this.situationalInitBonus += 5;
        if(MML.isWieldingRangedWeapon(this)){
                this.missileAttackMod += 15;
            }
        }
};
MML.statusEffects["Taking Aim"] = function(effect, index){
    if(_.has(this.statusEffects, "Number of Defenses") ||
       _.has(this.statusEffects, "Damaged This Round") ||
       _.has(this.statusEffects, "Dodged This Round") ||
       this.action.targets[0] !== effect.target)
    {
        delete this.statusEffects[index];
    }
    else{
        if(effect.level === 1){
            this.missileAttackMod += 30;
        }
        else if(effect.level === 2){
            this.missileAttackMod += 40;
        }
    }
};
MML.statusEffects["Damaged This Round"] = function(effect, index){

};
MML.statusEffects["Dodged This Round"] = function(effect, index){

};
MML.statusEffects["Melee This Round"] = function(effect, index){
    if(state.MML.GM.roundStarted === false){
        this.roundsExertion++;
        delete this.statusEffects[index];
    }
};
