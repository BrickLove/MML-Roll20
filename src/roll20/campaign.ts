import * as Roll20 from "./roll20";

export class Campaign implements Roll20.IObject {
  readonly type: Roll20.ObjectType.Campaign;
  readonly id: Roll20.Id;

  get(property: string) {
    return this[property];
  }

  set(property: string, value: any) {
    this[property] = value;
  }

  setWithWorker(properties: object) {
    Object.assign(this, properties);
  }
}