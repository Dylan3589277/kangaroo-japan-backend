import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly API_BASE = 'https://app.kangaroo-japan.com';

  async jp2zh(
    src: string,
  ): Promise<{ code: number; errmsg: string; data?: unknown }> {
    if (!src) return { code: 1, errmsg: '请输入要翻译的内容' };

    // 代理到PHP后端的翻译API
    try {
      const res = await fetch(`${this.API_BASE}/api/trans2zh/jp2zh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ src }),
      });
      const data: { code: number; errmsg: string; data?: unknown } =
        (await res.json()) as { code: number; errmsg: string; data?: unknown };
      return data;
    } catch (e: unknown) {
      this.logger.error(
        `Translate failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { code: 1, errmsg: '翻译服务暂时不可用' };
    }
  }
}
