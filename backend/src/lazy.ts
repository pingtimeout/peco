export type LazyInitializer<T> = () => T;

export class Lazy<T> {
  private instance: T | null = null;
  private readonly initializer: LazyInitializer<T>;

  constructor(initializer: LazyInitializer<T>) {
    this.initializer = initializer;
  }

  public get value(): T {
    if (this.instance == null) {
      this.instance = this.initializer();
    }
    return this.instance;
  }
}
