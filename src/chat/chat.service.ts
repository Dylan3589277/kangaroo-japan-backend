import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
  getKefuUrl(gid: string, shop: string) {
    // 代理到PHP后端
    // 或者直接返回静态的客服URL配置
    return {
      url: `https://app.kangaroo-japan.com/chat?gid=${gid}&shop=${shop}`,
    };
  }
}
