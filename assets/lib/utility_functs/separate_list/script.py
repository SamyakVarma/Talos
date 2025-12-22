def separate_list(inputs, outputIdx = 2): #([list, n], idx)
    inList = inputs[0]
    return inList[min(outputIdx, int(inputs[1])-1)]
