declare module "input" {
  const input: {
    text(prompt: string): Promise<string>;
    password(prompt: string): Promise<string>;
    confirm(prompt: string): Promise<boolean>;
    select(prompt: string, choices: string[]): Promise<string>;
  };
  export default input;
}
