import fetchROM from './romFetcher'

interface Instruction {
  name: string,
  args: {
    nnn: number
    x: number,
    y: number,
    kk: number
  }
}

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
  IRegister = 0

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
  display = new Array(64 * 32)


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
    console.log('I Register: ', this.IRegister)
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
        this.display = new Array(64 * 32) 
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
      default:
        throw Error(`Unknown instruction: ${name}`)
    }
  }

  getOpCode() {
    const firstByte = this.memory[this.PC]
    const secondByte = this.memory[this.PC + 1]

    return firstByte << 8 | secondByte
  }

  instructionFromOP(opcode: number): Instruction {
    const nnn = opcode & 0x0FFF
    const x = (opcode & 0x0F00) >> 8
    const y = (opcode & 0x00F0) >> 4
    const kk = opcode & 0x00FF

    const args = {
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
  const rom = await fetchROM('chip8pic.ch8')
  //interpreter.loadROM(rom)
  const testRom = new Uint8Array([0x71, 0x0F, 0x81, 0x05])
  interpreter.loadROM(testRom)
  interpreter.tick()
  interpreter.dumpState()
  interpreter.tick()
  interpreter.dumpState()
})()

