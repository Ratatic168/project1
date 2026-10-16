interface Foo {
  a: number;
}
const f: Foo = { a: 1 };
console.log('TS-STRIP-OK', f.a);
