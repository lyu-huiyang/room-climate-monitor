const LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
const DARK = ['#3987e5', '#d95926', '#199e70', '#c98500']

/** Color for the sensor at `index` in the name-sorted sensor list. */
export function sensorColor(index: number, dark: boolean): string {
  const palette = dark ? DARK : LIGHT
  return palette[index % palette.length]
}
