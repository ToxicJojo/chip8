const fetchROM = async (name: string) => {
  const response = await fetch(`/roms/${name}`);
  const arrayBuffer = await response.arrayBuffer()

  return new Uint8Array(arrayBuffer)
}

export default fetchROM
