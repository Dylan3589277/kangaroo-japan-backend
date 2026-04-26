<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/4
 * Time: 23:33
 * description:
 */

namespace app\api\controller;

use app\common\model\Pictures;
use app\common\service\aliyun\AliyunService;
use think\Exception;
use think\facade\Config;
use think\facade\Filesystem;

class Files extends Base
{
    /**
     * 上传第一个
     * @return \think\response\Json
     */
    public function uploadpic()
    {
        $files = request()->file();
        if (empty($files)) {
            return $this->jerror('请选择图片');
        }
        $fileName = array_keys($files)[0];
        $file = array_values($files)[0];
        try {
            validate([$fileName => ['fileSize:2048000', 'fileExt:jpg,png']])
                ->check([$fileName => $file]);
            $model = new Pictures();
            $md5 = md5_file($_FILES[$fileName]['tmp_name']);
            //-- 检查是否已经上传过了
            $uploadedInfo = $model->where('md5',$md5)->find();
            if($uploadedInfo){
                return $this->jsuccess('ok', ['path' => oss_url($uploadedInfo['url'])]);
                //-- 已经上传过同类型的
            }

            $driver = Filesystem::getDefaultDriver();
            if($driver == 'local'){
                $path = Filesystem::disk('public')->putFile('picture', $file, 'md5');
                if(!$path){
                    return $this->jerror('上传失败');
                }
                $path = \think\facade\Config::get('filesystem.disks.public.url').'/'.rtrim($path,'/');
            }else{
                $aliyun = new AliyunService(Config::get('config'));
                $path = $aliyun->save($_FILES[$fileName],'picture');
                if(!$path){
                    return $this->jerror('上传失败');
                }
                $path = oss_url($path);
            }

            //-- 保存记录
            $model = new Pictures();
            $model->addRow($_FILES[$fileName],$path);

            $flag = input('f','');
            if($flag == 'editor'){
                $resArr = [
                    'errcode' => 0,
                    'errno' => 0,
                    'data' => [
                        [
                            'url' => oss_url($path) ,
                            'alt' => '',
                            'href' => ''
                        ]
                    ]
                ];
                return json($resArr);
            }


            return $this->jsuccess('ok', ['path' => oss_url($path)]);
        }
        catch (\think\exception\ValidateException $e) {
            return $this->jerror($e->getMessage());
        }catch (Exception $e){
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 上传多个图片
     * @return \think\response\Json
     */
    public function uploadpics()
    {
        $files = request()->file();
        if (empty($files)) {
            return $this->jerror('请选择图片');
        }
        try {
            foreach ($files as $key => $file) {
                validate([$key => ['fileSize:102400', 'fileExt:jpg,png']])
                    ->check([$key => $file]);
            }
            $path = [];
            foreach ($files as $cfile) {
                $result = Filesystem::disk('public')->putFile('picture', $cfile, 'md5');
                $path[] = oss_url($result);
            }
            return $this->jsuccess('ok', ['paths' => $path]);
        }
        catch (\think\exception\ValidateException $e) {
            return $this->jerror($e->getMessage());
        }catch (Exception $e){
            return $this->jerror($e->getMessage());
        }
    }
}