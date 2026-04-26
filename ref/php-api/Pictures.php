<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/6
 * Time: 00:05
 * description:
 */
namespace app\common\model;
use think\Model;

class Pictures extends Model
{
    protected $table = 'st_picture';
    protected $autoWriteTimestamp = true;

    public function addRow($fileInfo,$path){
        $data = [
            'title' => $fileInfo['name'],
            'url' => $path,
            'ext' => pathinfo($fileInfo['name'],PATHINFO_EXTENSION),
            'size' => $fileInfo['size'],
            'mimetype' => $fileInfo['type']
        ];
        $this->save($data);
    }
}