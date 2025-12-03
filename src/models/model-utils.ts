export const defaultJSONTransform = (_doc: any, _ret: any) => {
    const result = _ret as any;
    delete result.__v; 
    delete result._id;
}