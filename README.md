# mediator

## URL schema

https://media.signalwerk.ch/{project}/{hash}/{operations?}/{slug}.{format}

## Example

http://localhost:3000/typesetting/4d8fb820f85446c9d8abf3592a5d80f60ac75c53dc9f45d39a5c565ffce4427c/resize@width:400;crop@left:10,top:20,width:300,height:200;/slug.jpg

## Operations (implemented)

### resize

- `width`
- `height`
- `fit` (`cover` (default), `contain`, `fill`, `inside`, `outside`)

### crop

- `left`
- `top`
- `width`
- `height`

### flatten

- `background`

## Backup

All files are stored nightly to Dropbox. Generate a Token here:

https://www.dropbox.com/developers/apps/
