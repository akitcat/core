import {
  ConnectedSocket,
  GatewayMetadata,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Emitter } from '@socket.io/redis-emitter'
import { plainToClass } from 'class-transformer'
import { validate } from 'class-validator'
import dayjs from 'dayjs'
import SocketIO from 'socket.io'
import { RedisKeys } from '~/constants/cache.constant'
import { CacheService } from '~/processors/cache/cache.service'
import { getRedisKey } from '~/utils/redis.util'
import { BaseGateway } from '../base.gateway'
import { EventTypes } from '../events.types'
import { DanmakuDto } from './dtos/danmaku.dto'

@WebSocketGateway<GatewayMetadata>({
  namespace: 'web',
})
export class WebEventsGateway
  extends BaseGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly cacheService: CacheService) {
    super()
  }

  @WebSocketServer()
  private namespace: SocketIO.Namespace

  async sendOnlineNumber() {
    return {
      online: this.currentClientCount,
      timestamp: new Date().toISOString(),
    }
  }
  @SubscribeMessage(EventTypes.DANMAKU_CREATE)
  createNewDanmaku(
    @MessageBody() data: DanmakuDto,
    @ConnectedSocket() client: SocketIO.Socket,
  ) {
    const validator = plainToClass(DanmakuDto, data)
    validate(validator).then((errors) => {
      if (errors.length > 0) {
        return client.send(errors)
      }
      this.broadcast(EventTypes.DANMAKU_CREATE, data)
      client.send([])
    })
  }

  get currentClientCount() {
    const server = this.namespace.server
    const clientCount = server.of('/web').adapter.rooms.size
    return clientCount
  }
  async handleConnection(socket: SocketIO.Socket) {
    this.broadcast(EventTypes.VISITOR_ONLINE, await this.sendOnlineNumber())

    process.nextTick(async () => {
      const redisClient = this.cacheService.getClient()
      const dateFormat = dayjs().format('YYYY-MM-DD')

      // get and store max_online_count
      const maxOnlineCount =
        +(await redisClient.get(
          getRedisKey(RedisKeys.MaxOnlineCount, dateFormat),
        )) || 0
      await redisClient.set(
        getRedisKey(RedisKeys.MaxOnlineCount, dateFormat),
        Math.max(maxOnlineCount, this.currentClientCount),
      )
      const key = getRedisKey(RedisKeys.MaxOnlineCount, dateFormat) + '_total'
      const totalCount = +(await redisClient.get(key)) || 0
      await redisClient.set(key, totalCount + 1)
    })

    super.handleConnect(socket)
  }
  async handleDisconnect(client: SocketIO.Socket) {
    super.handleDisconnect(client)
    this.broadcast(EventTypes.VISITOR_OFFLINE, await this.sendOnlineNumber())
  }

  broadcast(event: EventTypes, data: any) {
    const client = new Emitter(this.cacheService.getClient())
    client.of('/web').emit('message', this.gatewayMessageFormat(event, data))
  }
}
