export abstract class Entity {
  private static nextIdCounter = 1;
  public readonly id: string;

  constructor(prefix = 'entity') {
    this.id = `${prefix}_${Entity.nextIdCounter++}`;
  }

  public abstract fixedUpdate(fixedDt: number): void;
  public abstract update(dt: number, alpha: number): void;

  public destroy(): void {
    // Hook opcional para limpieza de recursos por entidad
  }
}

export class EntityManager {
  public readonly entities: Entity[] = [];

  public add<T extends Entity>(entity: T): T {
    this.entities.push(entity);
    return entity;
  }

  public remove(id: string): void {
    const idx = this.entities.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.entities[idx].destroy();
      this.entities.splice(idx, 1);
    }
  }

  public getById(id: string): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  public fixedUpdate(fixedDt: number): void {
    for (let i = 0; i < this.entities.length; i++) {
      this.entities[i].fixedUpdate(fixedDt);
    }
  }

  public update(dt: number, alpha: number): void {
    for (let i = 0; i < this.entities.length; i++) {
      this.entities[i].update(dt, alpha);
    }
    // Espacio reservado para futuras entidades (EnemyEntity, CollectibleEntity, PhysicsPropEntity)
  }

  public clear(): void {
    for (let i = 0; i < this.entities.length; i++) {
      this.entities[i].destroy();
    }
    this.entities.length = 0;
  }
}
