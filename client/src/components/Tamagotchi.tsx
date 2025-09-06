import { useEffect, useRef } from 'react';
import { createActor } from 'xstate';
import { tradingCharacterMachine } from '@/tamagotchi/stateMachine';
import { TradingCharacter } from '@/tamagotchi/TradingCharacter';
import { connectTamagotchi } from '@/lib/tamagotchiSocket';

/**
 * React wrapper for the TradingCharacter. It sets up the PixiJS canvas,
 * connects to the XState machine and listens for server-side events
 * delivered over WebSocket from the TradingView webhook.
 */
export default function Tamagotchi() {
  const containerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<TradingCharacter | null>(null);
  const actorRef = useRef<ReturnType<typeof createActor> | null>(null);

  // Setup character and state machine
  useEffect(() => {
    console.log('🎈 Tamagotchi: Initializing component...');

    const character = new TradingCharacter();
    const actor = createActor(tradingCharacterMachine).start();

    characterRef.current = character;
    actorRef.current = actor;

    console.log('🎈 Tamagotchi: Initial state:', actor.getSnapshot().value);

    let sub: { unsubscribe: () => void } | undefined;

    async function init() {
      if (containerRef.current) {
        await character.initialize(containerRef.current);
      }

      sub = actor.subscribe((state) => {
        console.log('🎈 Tamagotchi: State changed to:', state.value, 'Context:', state.context);
        character.play(state.value as string);
      });
    }

    init();

    return () => {
      console.log('🎈 Tamagotchi: Cleaning up...');
      sub?.unsubscribe();
      actor.stop();
    };
  }, []);

  // Connect to WebSocket for Tamagotchi events
  useEffect(() => {
    console.log('🎈 Tamagotchi: Connecting to WebSocket...');
    const disconnect = connectTamagotchi((event) => {
      console.log('🎈 Tamagotchi: Received WebSocket event:', event);
      if (event?.type) {
        console.log(`🎈 Tamagotchi: Sending '${event.type}' to state machine`);
        actorRef.current?.send({ type: event.type });
      }
    });
    return disconnect;
  }, []);

  return <div ref={containerRef} />;
}

