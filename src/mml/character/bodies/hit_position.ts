import { Integer } from "../../../utilities/integer";

export interface IHitPosition {
  readonly name: string;
  readonly number: Integer.Unsigned;
}



// MML.hitPositions = {
//   humanoid: {
//     1: {name: "Top of Head", bodyPart: "Head", number: 1},
//     2: {name: "Face", bodyPart: "Head", number: 2},
//     3: {name: "Rear of Head", bodyPart: "Head", number: 3},
//     4: {name: "Right Side of Head", bodyPart: "Head", number: 4},
//     5: {name: "Left Side of Head", bodyPart: "Head", number: 5},
//     6: {name: "Neck, Throat", bodyPart: "Head", number: 6},
//     7: {name: "Rear of Neck", bodyPart: "Head", number: 7},
//     8: {name: "Right Shoulder", bodyPart: "Right Arm", number: 8},
//     9: {name: "Right Upper Chest", bodyPart: "Chest", number: 9},
//     10: {name: "Right Upper Back", bodyPart: "Chest", number: 10},
//     11: {name: "Left Upper Chest", bodyPart: "Chest", number: 11},
//     12: {name: "Left Upper Back", bodyPart: "Chest", number: 12},
//     13: {name: "Left Shoulder", bodyPart: "Left Arm", number: 13},
//     14: {name: "Right Upper Arm", bodyPart: "Right Arm", number: 14},
//     15: {name: "Right Lower Chest", bodyPart: "Chest", number: 15},
//     16: {name: "Right Mid Back", bodyPart: "Chest", number: 16},
//     17: {name: "Left Lower Chest", bodyPart: "Chest", number: 17},
//     18: {name: "Left Mid Back", bodyPart: "Chest", number: 18},
//     19: {name: "Left Upper Arm", bodyPart: "Left Arm", number: 19},
//     20: {name: "Right Elbow", bodyPart: "Right Arm", number: 20},
//     21: {name: "Right Abdomen", bodyPart: "Abdomen", number: 21},
//     22: {name: "Right Lower Back", bodyPart: "Abdomen", number: 22},
//     23: {name: "Left Abdomen", bodyPart: "Abdomen", number: 23},
//     24: {name: "Left Lower Back", bodyPart: "Abdomen", number: 24},
//     25: {name: "Left Elbow", bodyPart: "Left Arm", number: 25},
//     26: {name: "Right Forearm", bodyPart: "Right Arm", number: 26},
//     27: {name: "Right Hip", bodyPart: "Abdomen", number: 27},
//     28: {name: "Right Buttock", bodyPart: "Abdomen", number: 28},
//     29: {name: "Left Hip", bodyPart: "Abdomen", number: 29},
//     30: {name: "Left Buttock", bodyPart: "Abdomen", number: 30},
//     31: {name: "Left Forearm", bodyPart: "Left Arm", number: 31},
//     32: {name: "Right Hand/Wrist", bodyPart: "Right Arm", number: 32},
//     33: {name: "Groin", bodyPart: "Abdomen", number: 33},
//     34: {name: "Left Hand/Wrist", bodyPart: "Left Arm", number: 34},
//     35: {name: "Right Upper Thigh", bodyPart: "Right Leg", number: 35},
//     36: {name: "Left Upper Thigh", bodyPart: "Left Leg", number: 36},
//     37: {name: "Right Lower Thigh", bodyPart: "Right Leg", number: 37},
//     38: {name: "Left Lower Thigh", bodyPart: "Left Leg", number: 38},
//     39: {name: "Right Knee", bodyPart: "Right Leg", number: 39},
//     40: {name: "Left Knee", bodyPart: "Left Leg", number: 40},
//     41: {name: "Right Upper Shin", bodyPart: "Right Leg", number: 41},
//     42: {name: "Left Upper Shin", bodyPart: "Left Leg", number: 42},
//     43: {name: "Right Lower Shin", bodyPart: "Right Leg", number: 43},
//     44: {name: "Left Lower Shin", bodyPart: "Left Leg", number: 44},
//     45: {name: "Right Foot/Ankle", bodyPart: "Right Leg", number: 45},
//     46: {name: "Left Foot/Ankle", bodyPart: "Left Leg", number: 46}
//   }
// };
