import { createMachine, assign } from 'xstate';

/**
 * Basic XState finite state machine describing the tamagotchi character's
 * emotional responses to trading performance. This will evolve as more
 * complex behaviour is added.
 */
export const tradingCharacterMachine = createMachine({
  id: 'tradingCharacter',
  initial: 'idle',
  context: {
    happiness: 50,
    confidence: 50,
    energy: 75
  },
  states: {
    idle: {
      on: {
        TRADE_SUCCESS: {
          target: 'celebrating',
          actions: assign({

            happiness: ({ context }: any) => Math.min(100, context.happiness + 20),
            confidence: ({ context }: any) => Math.min(100, context.confidence + 15)

          })
        },
        TRADE_LOSS: {
          target: 'concerned',
          actions: assign({

            happiness: ({ context }: any) => Math.max(0, context.happiness - 10),
            confidence: ({ context }: any) => Math.max(0, context.confidence - 20)

          })
        },
        MARKET_ANALYSIS: 'analyzing',
        SLEEP_TIME: 'sleeping'
      }
    },
    celebrating: {
      after: { 3000: 'idle' }
    },
    concerned: {
      after: { 5000: 'idle' }
    },
    analyzing: {
      on: { ANALYSIS_COMPLETE: 'idle' }
    },
    sleeping: {
      on: { WAKE_UP: 'idle' }
    }
  }
});

