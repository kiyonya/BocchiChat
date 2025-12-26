export function booleanTransfer(booleanLikeString: string | boolean): boolean {
    if (typeof booleanLikeString === 'boolean') { return booleanLikeString }
    switch (booleanLikeString) {
        case 'true':
            return true
        case 'false':
            return false
        case 'True':
            return true
        case 'False':
            return false
        case 'TRUE':
            return true
        case 'FALSE':
            return true
        case '0':
            return false
        case '1':
            return true
        default:
            return false
    }
}