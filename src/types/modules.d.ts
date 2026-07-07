// world-atlas ships raw TopoJSON with no type declarations; typing it as `any`
// also keeps tsc from parsing the ~700 KB JSON literal on every build.
declare module 'world-atlas/countries-110m.json' {
  const topology: any;
  export default topology;
}
