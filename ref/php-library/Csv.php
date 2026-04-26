<?php
namespace app\common\library;

class Csv
{
    /**
     * @param \Generator|array $data
     * @param string $filename
     */
    public static function export($data, string $filename = '')
    {
        self::_setHeader($filename ?: date('YmdHis'));
        self::_putCsv($data);
        exit;
    }

    /**
     * @param string $filename
     */
    private static function _setHeader(string $filename)
    {
        header('Content-Encoding: UTF-8');
        header('Content-Type: text/csv;charset=UTF-8');
        header("Content-Disposition: attachment;filename=\"{$filename}.csv\"");
        header('Cache-Control: no-cache, private');
        header('Date: ' . gmdate('D, d M Y H:i:s') . ' GMT');
    }

    /**
     * @param \Generator|array $data
     */
    private static function _putCsv($data)
    {
        $handle = fopen('php://output', 'w');
        //导出的CSV文件是无BOM编码UTF-8，而我们通常使用UTF-8编码格式都是有BOM的。所以添加BOM于CSV中
        fwrite($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));
        foreach ($data as $datum) {
            fputcsv($handle, $datum);
        }
        fclose($handle);
    }
}
