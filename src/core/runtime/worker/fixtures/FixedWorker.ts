import {
  WORKER_PROTOCOL_VERSION,
  type MainToWorkerMessage,
  type WorkerToMainMessage,
} from '../protocol'

export class FixedWorker extends EventTarget {
  readonly received: MainToWorkerMessage[] = []
  terminated = false
  listenerBalance = 0

  asWorker(): Worker {
    return this as unknown as Worker
  }

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type, listener, options)
    this.listenerBalance += 1
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(type, listener, options)
    this.listenerBalance -= 1
  }

  postMessage(
    message: MainToWorkerMessage,
    transfer: Transferable[] = [],
  ): void {
    const received = structuredClone(message, { transfer })
    this.received.push(received)

    if (received.type === 'start') {
      this.emit({
        type: 'ready',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        generation: received.generation,
      })
    } else if (received.type === 'close') {
      this.emit({
        type: 'closed',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        generation: received.generation,
      })
    }
  }

  respond(
    generation: string,
    requestId: string,
    payload: unknown,
    transfer: Transferable[] = [],
  ): void {
    this.emit(
      structuredClone(
        {
          type: 'response',
          protocolVersion: WORKER_PROTOCOL_VERSION,
          generation,
          requestId,
          ok: true,
          payload,
        } satisfies WorkerToMainMessage,
        { transfer },
      ),
    )
  }

  failResponse(generation: string, requestId: string, code: string): void {
    this.emit({
      type: 'response',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation,
      requestId,
      ok: false,
      error: { code },
    })
  }

  crash(type: 'error' | 'messageerror' = 'error'): void {
    this.dispatchEvent(new Event(type))
  }

  terminate(): void {
    this.terminated = true
  }

  requests(): Extract<MainToWorkerMessage, { type: 'request' }>[] {
    return this.received.filter(
      (message): message is Extract<MainToWorkerMessage, { type: 'request' }> =>
        message.type === 'request',
    )
  }

  cancellations(): Extract<MainToWorkerMessage, { type: 'cancel' }>[] {
    return this.received.filter(
      (message): message is Extract<MainToWorkerMessage, { type: 'cancel' }> =>
        message.type === 'cancel',
    )
  }

  private emit(message: WorkerToMainMessage): void {
    queueMicrotask(() => {
      this.dispatchEvent(new MessageEvent('message', { data: message }))
    })
  }
}
