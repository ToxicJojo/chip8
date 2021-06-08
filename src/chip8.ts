import fetchROM from './romFetcher'
import font from './font'

interface Instruction {
  name: string,
  args: {
    n: number,
    nnn: number
    x: number,
    y: number,
    kk: number
  }
}

const SCREEN_WIDTH = 64
const SCREEN_HEIGHT = 32
const FONT_OFFSET = 0x050

class Interpreter {
  /**
   * The main memory of the chip.
   */
  memory = new Uint8Array(4096)

  /**
   * The main registers of the chip
   */
  registers = new Uint8Array(16)

  /**
   * The stack
   */
  stack = new Uint16Array(16)

  /**
   * I Register
   */
  I = 0

  /**
   * Delay timer 
   */
  DT = 0

  /**
   * Sound timer 
   */
  ST = 0

  /**
   * The program counter
   */
  PC = 0x200

  /**
   * The stack pointer
   */
  SP = 0

  /**
   * The display 
   */
  display = new Array(SCREEN_WIDTH * SCREEN_HEIGHT)

  loadFont() {
    for (let i = 0; i < font.length; i++) {
      this.memory[FONT_OFFSET + i] = font[i]
    }
  }

  loadROM(rom: Uint8Array) {
    for (let i = 0; i < rom.length ; i++) {
      this.memory[i + 0x200] = rom[i]
    }
  }

  dumpState() {
    console.log('--- INTERPRETER DUMP ---')
    console.log('Register: ', this.registers)
    console.log('Stack: ', this.stack)
    console.log('Stack Pointer: ', this.SP)
    console.log('Program Counter: ', this.PC)
    console.log('I Register: ', this.I)
    console.log('Delay Timer: ', this.DT)
    console.log('Sound Timer: ', this.ST)
    console.log('--- INTERPRETER DUMP ---')
  }

  tick() {
    const opCode = this.getOpCode()

    const instruction = this.instructionFromOP(opCode)
    this.executeInstruction(instruction)

    this.PC = this.PC + 2
  }

  executeInstruction({ name, args }: Instruction) {
    switch (name) {
      case 'CLS':
        /**
         * Clear the display.
         */
        this.display = new Array(SCREEN_WIDTH * SCREEN_HEIGHT) 
        break;
      case 'RET':
        /**
         * Return from a subroutine.
         * The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack pointer.
         */
        this.PC = this.stack[this.SP]
        this.SP--
        break;
      case 'JP':
        /**
         * Jump to location nnn.
         * The interpreter sets the program counter to nnn.
         */
        this.PC = args.nnn
        break;
      case 'CALL':
        /**
         * Call subroutine at nnn.
         * The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set to nnn.
         */
        this.SP++
        this.stack[this.SP] = this.PC
        this.PC = args.nnn
        break;
      case 'SE_Vx_byte':
        /**
         * Skip next instruction if Vx = kk.
         * The interpreter compares register Vx to kk, and if they are equal, increments the program counter by 2.
         */
        if (this.registers[args.x] === args.kk) {
          this.PC = this.PC + 2
        }
        break;
        case 'SNE_Vx_byte':
          /**
           * Skip next instruction if Vx != kk.
           * The interpreter compares register Vx to kk, and if they are not equal, increments the program counter by 2.
           */
          if (this.registers[args.x] !== args.kk) {
            this.PC = this.PC + 2
          }
          break;
        case 'SE_Vx_Vy':
          /**
           * Skip next instruction if Vx = Vy.
           * The interpreter compares register Vx to register Vy, and if they are equal, increments the program counter by 2.
           */
          if (this.registers[args.x] === this.registers[args.y]) {
            this.PC = this.PC + 2
          }
          break;
        case 'LD_Vx_byte':
          /**
           * Set Vx = kk.
           * The interpreter puts the value kk into register Vx.
           */
          this.registers[args.x] = args.kk
          break;
        case 'ADD_Vx_byte':
          /**
           * Set Vx = Vx + kk.
           * Adds the value kk to the value of register Vx, then stores the result in Vx.
           */
           this.registers[args.x] = this.registers[args.x] + args.kk 
          break;
        case 'LD_Vx_Vy':
          /**
           * Set Vx = Vy.
           * Stores the value of register Vy in register Vx.
           */
          this.registers[args.x] = this.registers[args.y]
          break;
        case 'OR_Vx_Vy':
          /**
           * Set Vx = Vx OR Vy.
           * Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx. A bitwise OR compares the corrseponding bits from two values, and if either bit is 1, then the same bit in the result is also 1. Otherwise, it is 0.
           */
          this.registers[args.x] = this.registers[args.x] | this.registers[args.y]
          break;
        case 'AND_Vx_Vy':
          /**
           * Set Vx = Vx AND Vy.
           * Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx. A bitwise AND compares the corrseponding bits from two values, and if both bits are 1, then the same bit in the result is also 1. Otherwise, it is 0.
           */
          this.registers[args.x] = this.registers[args.x] & this.registers[args.y]       
          break;
        case 'XOR_Vx_Vy':
          /**
           * Set Vx = Vx XOR Vy.
           * Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result in Vx. An exclusive OR compares the corrseponding bits from two values, and if the bits are not both the same, then the corresponding bit in the result is set to 1. Otherwise, it is 0.
           */
          this.registers[args.x] = this.registers[args.x] ^ this.registers[args.y]       
          break;
        case 'ADD_Vx_Vy':
          /**
           * Set Vx = Vx + Vy, set VF = carry.
           * The values of Vx and Vy are added together. If the result is greater than 8 bits (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result are kept, and stored in Vx.
           */
          const result = this.registers[args.x] + this.registers[args.y]
          this.registers[args.x] = result
          if (result > 255) {
            this.registers[0xF] = 1
          } else {
            this.registers[0xF] = 0
          }
          break;
        case 'SUB_Vx_Vy':
          /**
           * Set Vx = Vx - Vy, set VF = NOT borrow.
           * If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
           */
          if (this.registers[args.x] > this.registers[args.y]) {
            this.registers[0xF] = 1
          } else {
            this.registers[0xF] = 0
          }

          this.registers[args.x] = this.registers[args.x] - this.registers[args.y]          
          break;
        case 'SHR_Vx_Vy':
          /**
           * Set Vx = Vx SHR 1.
           * If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
           */
          if ((this.registers[args.x] & 0x01) === 1) {
            this.registers[0xF] = 1
          } else {
            this.registers[0xF] = 0
          }

          this.registers[args.x] = this.registers[args.x] >> 1
          break;
        case 'SUBN_Vx_Vy':
          /**
           * Set Vx = Vy - Vx, set VF = NOT borrow.
           * If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
           */
          if (this.registers[args.y] > this.registers[args.x]) {
            this.registers[0xF] = 1
          } else {
            this.registers[0xF] = 0
          }

          this.registers[args.x] = this.registers[args.y] - this.registers[args.x]
          break;
        case 'SHL_Vx_Vy':
          /**
           * Set Vx = Vx SHL 1.
           * If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2.
           */
          if ((this.registers[args.x] & 0x10) === 0x10) {
            this.registers[0xF] = 1
          } else {
            this.registers[0xF] = 0
          }

          this.registers[args.x] = this.registers[args.x] << 1
          break;
        case 'SNE_Vx_Vy':
          /**
           * Skip next instruction if Vx != Vy.
           * The values of Vx and Vy are compared, and if they are not equal, the program counter is increased by 2.
           */
          if (this.registers[args.x] !== this.registers[args.y]) {
            this.PC = this.PC + 2
          }
          break;
        case 'LD_I':
          this.I = args.nnn
          break;
        case 'JP_V0':
          /**
           * Jump to location nnn + V0.
           * The program counter is set to nnn plus the value of V0.
           */
          this.PC = this.registers[0] + args.nnn
        case 'RND_Vx_byte':
          /**
           * Set Vx = random byte AND kk.
           * The interpreter generates a random number from 0 to 255, which is then ANDed with the value kk. The results are stored in Vx. See instruction 8xy2 for more information on AND.
           */
          const random = Math.floor(Math.random() * 256)
          this.registers[args.x] = random & args.kk
          break;
        case 'DRW_Vx_Vy':
          /**
           * Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
           * The interpreter reads n bytes from memory, starting at the address stored in I. These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). Sprites are XORed onto the existing screen. If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of the display, it wraps around to the opposite side of the screen. See instruction 8xy3 for more information on XOR, and section 2.4, Display, for more information on the Chip-8 screen and sprites.
           */
          this.registers[0xF] = 0
          const startX = this.registers[args.x] % SCREEN_WIDTH
          const startY = this.registers[args.y] % SCREEN_HEIGHT

          for (let y = 0; y < args.n; y++) {
            if (startY + y >= SCREEN_HEIGHT) break
            const spriteRow = this.memory[this.I + y]
            for (let x = 0; x < 8; x++) {
              if (startX + x >= SCREEN_WIDTH) break

              const spriteBit = (spriteRow & (1 << 7 - x)) === 0 ? 0 : 1
              const displayPos = ((y + startY) * SCREEN_WIDTH) + (x + startX)

              const oldPixel = this.display[displayPos]
              const newPixel = oldPixel ^ spriteBit

              this.display[displayPos] = newPixel
              if (oldPixel === 1 && newPixel === 0) {
                this.registers[0xF] = 1
              }
            }
          }
          break;
        case 'LD_Vx_DT':
          /**
           * Set Vx = delay timer value.
           * The value of DT is placed into Vx.
           */
          this.registers[args.x] = this.DT
          break;
        case 'LD_DT_Vx':
          /**
           * Set delay timer = Vx.
           * DT is set equal to the value of Vx.
           */
          this.DT = this.registers[args.x]
          break;
        case 'LD_ST_Vx':
          /**
           * Set sound timer = Vx.
           * ST is set equal to the value of Vx.
           */
          this.ST = this.registers[args.x]
          break;
        case 'ADD_I_Vx':
          /**
           * Set I = I + Vx.
           * The values of I and Vx are added, and the results are stored in I.
           */
          this.I = this.I + this.registers[args.x]
          break;
      default:
        throw Error(`Unknown instruction: ${name}`)
    }
  }

  printDisplay() {
    const preElement = document.querySelector('#screen')
    preElement.textContent = ''
    for (let i = 0; i < this.display.length; i++) {
      const pixel = this.display[i];
      if (i % SCREEN_WIDTH === 0) {
        preElement.textContent += '\n'
      }

      preElement.textContent += pixel ? 'OO' : '  '
    }
  }

  getOpCode() {
    const firstByte = this.memory[this.PC]
    const secondByte = this.memory[this.PC + 1]

    return firstByte << 8 | secondByte
  }

  instructionFromOP(opcode: number): Instruction {
    const n = opcode & 0x000F
    const nnn = opcode & 0x0FFF
    const x = (opcode & 0x0F00) >> 8
    const y = (opcode & 0x00F0) >> 4
    const kk = opcode & 0x00FF

    const args = {
      n,
      nnn,
      x,
      y,
      kk
    }

    let name = ''

    if (opcode === 0x00E0) {
      name = 'CLS'
    } else if (opcode === 0x00EE) {
      name = 'RET'
    } else if((opcode & 0xF000) === 0x1000) {
      name = 'JP'
    }  else if ((opcode & 0xF000) === 0x2000) {
      name = 'CALL'
    } else if ((opcode & 0xF000) === 0x3000) {
      name = 'SE_Vx_byte'
    } else if ((opcode & 0xF000) === 0x4000) {
      name = 'SNE_Vx_byte'
    } else if ((opcode & 0xF000) === 0x5000) {
      name = 'SE_Vx_Vy'
    } else if ((opcode & 0xF000) === 0x6000) {
      name = 'LD_Vx_byte'
    } else if ((opcode & 0xF000) === 0x7000) {
      name = 'ADD_Vx_byte'
    } else if ((opcode & 0xF00F) === 0x8000) {
      name = 'LD_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8001) {
      name = 'OR_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8002) {
      name = 'AND_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8003) {
      name = 'XOR_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8004) {
      name = 'ADD_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8005) {
      name = 'SUB_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8006) {
      name = 'SHR_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8007) {
      name = 'SUBN_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x8008) {
      name = 'SHL_Vx_Vy'
    } else if ((opcode & 0xF00F) === 0x9000) {
      name = 'SNE_Vx_Vy'
    } else if ((opcode & 0xF000) === 0xA000) {
      name = 'LD_I'
    } else if ((opcode & 0xF000) === 0xB000) {
      name = 'JP_V0'
    } else if ((opcode & 0xF000) === 0xC000) {
      name = 'RND_Vx_byte'
    } else if ((opcode & 0xF000) === 0xD000) {
      name = 'DRW_Vx_Vy'
    } else if ((opcode & 0xF0FF) === 0xF007) {
      name = 'LD_Vx_DT'
    } else if ((opcode & 0xF0FF) === 0xF015) {
      name = 'LD_DT_Vx'
    } else if ((opcode & 0xF0FF) === 0xF018) {
      name = 'LD_ST_Vx'
    } else if ((opcode & 0xF0FF) === 0xF01E) {
      name = 'ADD_I_Vx'
    }
    else {
      throw Error(`Unkown opcode: ${opcode.toString(16)}`)
    }

    return {
      name,
      args
    }
  }
}

(async () => {
  const interpreter = new Interpreter()
  interpreter.loadFont()
  console.log(interpreter.memory);
  
  const rom = await fetchROM('ibm.ch8')
  interpreter.loadROM(rom)
  const testRom = new Uint8Array([0x71, 0xFF, 0xC1, 0xFF])
  //interpreter.loadROM(testRom)
  let i = 0
  while(i < 32) {
    interpreter.tick()
    interpreter.printDisplay()
    i++
  }

})()

